// Issue #486 — AuditLog must declare a 1-year TTL via expireAfterSeconds.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'models', 'AuditLog.js'), 'utf8');

describe('Issue #486 — AuditLog TTL', () => {
    it('declares an index on createdAt with expireAfterSeconds = 1 year', () => {
        expect(src).toMatch(/AuditLogSchema\.index\(\s*\{[\s\S]*?createdAt[\s\S]*?\},\s*\{\s*expireAfterSeconds:\s*365\s*\*\s*24\s*\*\s*3600/);
    });
});
