/**
 * Regression for issue #91:
 * The root `Caddyfile` had no `log` directive — access/error logs went
 * to Caddy's default stdout sink with no structured format, no level
 * control, and no way to redirect without a restart. Edge-proxy access
 * logs are the single highest-signal observability source.
 *
 * Lock in: the Caddyfile declares a `log { ... }` block with `format json`.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const SRC = fs.readFileSync(path.join(REPO_ROOT, 'Caddyfile'), 'utf-8');

describe('Caddyfile structured logging (#91)', () => {
  it('declares a log {} block', () => {
    expect(SRC).toMatch(/\blog\s*\{/);
  });

  it('uses json log format', () => {
    expect(SRC).toMatch(/format\s+json/);
  });
});
