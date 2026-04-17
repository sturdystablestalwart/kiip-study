import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const express = require('express');
const request = require('supertest');
const { createOriginCheck } = require('../originCheck');

const makeApp = (origins) => {
    const app = express();
    app.use(express.json());
    app.use(createOriginCheck(origins));
    app.post('/test', (req, res) => res.json({ ok: true }));
    app.get('/test', (req, res) => res.json({ ok: true }));
    return app;
};

describe('originCheck middleware', () => {
    const allowed = ['http://localhost:5173', 'https://kiip.example.com'];

    test('POST with allowed Origin succeeds', async () => {
        const res = await request(makeApp(allowed))
            .post('/test')
            .set('Origin', 'http://localhost:5173');
        expect(res.status).toBe(200);
    });

    test('POST with disallowed Origin returns 403', async () => {
        const res = await request(makeApp(allowed))
            .post('/test')
            .set('Origin', 'https://evil.com');
        expect(res.status).toBe(403);
    });

    test('POST with no Origin falls back to Referer', async () => {
        const res = await request(makeApp(allowed))
            .post('/test')
            .set('Referer', 'http://localhost:5173/login');
        expect(res.status).toBe(200);
    });

    test('POST with no Origin and no Referer returns 403', async () => {
        const res = await request(makeApp(allowed)).post('/test');
        expect(res.status).toBe(403);
    });

    test('GET requests bypass the check', async () => {
        const res = await request(makeApp(allowed))
            .get('/test')
            .set('Origin', 'https://evil.com');
        expect(res.status).toBe(200);
    });
});
