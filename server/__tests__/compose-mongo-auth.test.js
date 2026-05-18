// Issue #465 — docker-compose must enable mongo auth, declare the
// root credential env vars, and use an auth-aware MONGO_URI for
// server + backup services.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

const compose = readFileSync(resolve(repoRoot, 'docker-compose.yaml'), 'utf8');
const envExample = readFileSync(resolve(repoRoot, '.env.example'), 'utf8');

describe('Issue #465 — mongo auth wiring', () => {
    it('mongo service runs mongod --auth', () => {
        expect(compose).toMatch(/command:\s*\["mongod",\s*"--auth",\s*"--bind_ip_all"\]/);
    });

    it('mongo service references MONGO_ROOT_USERNAME / MONGO_ROOT_PASSWORD with required-default sentinel', () => {
        expect(compose).toMatch(/MONGO_INITDB_ROOT_USERNAME=\$\{MONGO_ROOT_USERNAME:\?/);
        expect(compose).toMatch(/MONGO_INITDB_ROOT_PASSWORD=\$\{MONGO_ROOT_PASSWORD:\?/);
    });

    it('server MONGO_URI carries credentials and authSource=admin', () => {
        expect(compose).toMatch(/MONGO_URI=mongodb:\/\/\$\{MONGO_ROOT_USERNAME\}:\$\{MONGO_ROOT_PASSWORD\}@mongo:27017\/kiip_test_app\?authSource=admin/);
    });

    it('backup MONGO_URI carries credentials and authSource=admin', () => {
        expect(compose).toMatch(/MONGO_URI:\s*mongodb:\/\/\$\{MONGO_ROOT_USERNAME\}:\$\{MONGO_ROOT_PASSWORD\}@mongo:27017\/kiip_test_app\?authSource=admin/);
    });

    it('healthcheck no longer uses bare mongosh adminCommand ping (no creds)', () => {
        expect(compose).not.toMatch(/"mongosh",\s*"--eval",\s*"db\.adminCommand\('ping'\)"/);
    });

    it('.env.example documents MONGO_ROOT_USERNAME / MONGO_ROOT_PASSWORD', () => {
        expect(envExample).toMatch(/MONGO_ROOT_USERNAME=/);
        expect(envExample).toMatch(/MONGO_ROOT_PASSWORD=/);
    });
});
