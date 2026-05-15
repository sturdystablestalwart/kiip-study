import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

// Test for server/scripts/backfillAuthMethods.js — verifies that the
// one-shot migration correctly targets legacy User docs whose `authMethods`
// field is missing entirely, and is idempotent (re-run matches zero).
//
// We can't use mongodb-memory-server (not in this repo's devDependencies,
// and we mustn't touch package.json). Instead, we drive run() against a
// hand-rolled in-memory User-model stub that exposes `.collection.updateMany`
// with the same shape as the real Mongo driver.

// Required env (the script `require`s dotenv but won't fail without it).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-must-be-long-enough-for-validation-32chars';
process.env.NODE_ENV = 'test';

const require = createRequire(import.meta.url);
const { run } = require('../scripts/backfillAuthMethods.js');

// ─── Build a tiny in-memory "users collection" with the operators we need ───
function makeUsersStore(seed = []) {
    // Each doc is a plain object — mirrors what `User.collection.insertOne`
    // would store directly (bypassing Mongoose schema defaults).
    const docs = seed.map((d) => ({ ...d }));

    function matches(doc, filter) {
        // We only support the one operator we use: { authMethods: { $exists: false } }
        for (const [key, cond] of Object.entries(filter)) {
            if (cond && typeof cond === 'object' && '$exists' in cond) {
                const present = Object.prototype.hasOwnProperty.call(doc, key)
                    && doc[key] !== undefined;
                if (cond.$exists !== present) return false;
            } else {
                if (doc[key] !== cond) return false;
            }
        }
        return true;
    }

    function applyUpdate(doc, update) {
        if (update.$set) {
            for (const [k, v] of Object.entries(update.$set)) {
                doc[k] = v;
            }
        }
    }

    const collection = {
        async updateMany(filter, update) {
            let matched = 0;
            let modified = 0;
            for (const doc of docs) {
                if (matches(doc, filter)) {
                    matched++;
                    // Modified iff the $set actually changes the doc shape.
                    const before = JSON.stringify(doc);
                    applyUpdate(doc, update);
                    if (JSON.stringify(doc) !== before) modified++;
                }
            }
            return { matchedCount: matched, modifiedCount: modified };
        },
        // For test inspection
        _all: () => docs,
    };

    return { collection, _docs: docs };
}

describe('backfillAuthMethods.run()', () => {
    let store;
    let silentLogger;

    beforeEach(() => {
        silentLogger = { log: vi.fn(), error: vi.fn() };
    });

    it('sets authMethods=[] on 3 legacy docs and leaves the existing doc alone', async () => {
        store = makeUsersStore([
            { _id: 'a', email: 'legacy1@example.com', isAdmin: false },                           // no authMethods
            { _id: 'b', email: 'legacy2@example.com', isAdmin: false },                           // no authMethods
            { _id: 'c', email: 'legacy3@example.com', isAdmin: false },                           // no authMethods
            { _id: 'd', email: 'existing@example.com', isAdmin: false, authMethods: ['google'] }, // already has it
        ]);

        const FakeUser = { collection: store.collection };

        const result = await run({ logger: silentLogger, UserModel: FakeUser });

        expect(result.matched).toBe(3);
        expect(result.modified).toBe(3);

        const docs = store.collection._all();
        expect(docs.find((d) => d._id === 'a').authMethods).toEqual([]);
        expect(docs.find((d) => d._id === 'b').authMethods).toEqual([]);
        expect(docs.find((d) => d._id === 'c').authMethods).toEqual([]);

        // Existing doc is unchanged.
        expect(docs.find((d) => d._id === 'd').authMethods).toEqual(['google']);
    });

    it('is idempotent — a second run matches zero docs', async () => {
        store = makeUsersStore([
            { _id: 'a', email: 'legacy1@example.com', isAdmin: false },
            { _id: 'b', email: 'existing@example.com', isAdmin: false, authMethods: ['magic'] },
        ]);
        const FakeUser = { collection: store.collection };

        const first = await run({ logger: silentLogger, UserModel: FakeUser });
        expect(first.matched).toBe(1);
        expect(first.modified).toBe(1);

        const second = await run({ logger: silentLogger, UserModel: FakeUser });
        expect(second.matched).toBe(0);
        expect(second.modified).toBe(0);
    });

    it('returns 0/0 and does not throw on an empty collection', async () => {
        store = makeUsersStore([]);
        const FakeUser = { collection: store.collection };

        const result = await run({ logger: silentLogger, UserModel: FakeUser });
        expect(result.matched).toBe(0);
        expect(result.modified).toBe(0);
    });

    it('does not touch users whose authMethods is an empty array (treated as present)', async () => {
        store = makeUsersStore([
            { _id: 'a', email: 'a@example.com', isAdmin: false, authMethods: [] },
            { _id: 'b', email: 'b@example.com', isAdmin: false }, // truly legacy
        ]);
        const FakeUser = { collection: store.collection };

        const result = await run({ logger: silentLogger, UserModel: FakeUser });
        expect(result.matched).toBe(1);
        expect(result.modified).toBe(1);

        const docs = store.collection._all();
        expect(docs.find((d) => d._id === 'a').authMethods).toEqual([]); // unchanged
        expect(docs.find((d) => d._id === 'b').authMethods).toEqual([]); // backfilled
    });

    it('logs a one-line summary including matched and modified counts', async () => {
        store = makeUsersStore([
            { _id: 'a', email: 'a@example.com', isAdmin: false },
            { _id: 'b', email: 'b@example.com', isAdmin: false },
        ]);
        const FakeUser = { collection: store.collection };

        await run({ logger: silentLogger, UserModel: FakeUser });

        expect(silentLogger.log).toHaveBeenCalledTimes(1);
        const message = silentLogger.log.mock.calls[0][0];
        expect(message).toMatch(/matched=2/);
        expect(message).toMatch(/modified=2/);
    });

    it('exposes a `run` function (CLI exports module surface)', () => {
        expect(typeof run).toBe('function');
    });
});
