/**
 * One-time migration: backfill `authMethods: []` on legacy User docs that
 * predate the field (e.g. Google-only users from earlier deploys).
 *
 * Idempotent. Run once after deploying #110+#140. Logs count of users
 * backfilled. Subsequent runs match 0 documents because the filter requires
 * `authMethods` to be missing entirely (`$exists: false`).
 *
 * Run: `node server/scripts/backfillAuthMethods.js`
 *
 * Background: Issues #110 (P1) and #140 (P2). The verify route used
 *     user.authMethods.includes('magic')
 * which threw TypeError on legacy docs whose `authMethods` was `undefined`
 * (the schema had no `default: []` until #140 fixed that). Schema defaults
 * only apply on new save(); existing rows must be backfilled separately.
 *
 * NOTE: this script uses `User.collection.updateMany(...)` directly (raw
 * MongoDB driver) so the `$exists` operator survives. The Express-level
 * NoSQL sanitizer middleware strips `$`-prefixed keys from request bodies,
 * but it doesn't run here — we're in a one-shot Node script, not an HTTP
 * route — so this is safe.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Pure migration body. Exported so the unit test can drive it against any
 * already-connected Mongoose instance (or a stubbed User model) without
 * re-running the connect/disconnect lifecycle.
 *
 * @param {object} [opts]
 * @param {object} [opts.logger=console] - any object with .log/.error methods
 * @param {object} [opts.UserModel=User]  - dependency injection seam for tests
 * @returns {Promise<{ matched: number, modified: number }>}
 */
async function run({ logger = console, UserModel = User } = {}) {
    const result = await UserModel.collection.updateMany(
        { authMethods: { $exists: false } },
        { $set: { authMethods: [] } },
    );

    // The mongo driver returns { matchedCount, modifiedCount, ... }; older
    // wire versions expose { n, nModified }. Normalise.
    const matched = result.matchedCount ?? result.n ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    logger.log(`backfillAuthMethods: matched=${matched} modified=${modified}`);
    return { matched, modified };
}

// CLI entrypoint — connect, run, disconnect, exit. Skipped during tests
// because tests import the module and call run() directly.
async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/kiip_test_app';
    await mongoose.connect(uri);
    console.log(`backfillAuthMethods: connected to ${uri.replace(/:[^:@/]+@/, ':***@')}`);
    try {
        await run();
        console.log('backfillAuthMethods: complete');
        process.exitCode = 0;
    } catch (err) {
        console.error('backfillAuthMethods: failed', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = { run };
