// Issue #497 — strip Server header at Caddy and disable server_tokens
// at nginx so the proxy versions don't leak in fingerprintable form.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..', '..');
const caddy = readFileSync(resolve(root, 'Caddyfile'), 'utf8');
const nginx = readFileSync(resolve(root, 'client', 'nginx.conf'), 'utf8');

describe('Issue #497 — strip Server / nginx fingerprint headers', () => {
    it('Caddyfile strips the Server header via -Server', () => {
        expect(caddy).toMatch(/-Server\b/);
    });

    it('nginx.conf disables server_tokens', () => {
        expect(nginx).toMatch(/server_tokens\s+off\s*;/);
    });
});
