/**
 * Regression for issue #94:
 * The Compose healthcheck on caddy hit caddy's local admin API
 * (:2019/config/) but the deploy workflow hits `:80/health` (the actual
 * end-user path). A regression in caddy's reverse_proxy config could
 * pass `condition: service_healthy` while real traffic broke.
 *
 * Lock in: caddy's healthcheck tests the SAME path users hit —
 * `http://localhost/health` — which exercises bind + Caddyfile parse +
 * reverse_proxy → server + the /health handler end-to-end.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const SRC = fs.readFileSync(path.join(REPO_ROOT, 'docker-compose.yaml'), 'utf-8');

function sectionFor(service) {
  const re = new RegExp(
    `^  ${service}:\\s*$([\\s\\S]*?)(?=^  \\w+:\\s*$|^\\w+:\\s*$|\\Z)`,
    'm'
  );
  const m = SRC.match(re);
  return m ? m[1] : null;
}

describe('caddy healthcheck is end-to-end via /health (#94)', () => {
  it('caddy healthcheck probes the proxied /health path, not :2019', () => {
    const section = sectionFor('caddy');
    expect(section).not.toBeNull();
    expect(section).not.toMatch(/2019/);
    expect(section).toMatch(/http:\/\/localhost\/health/);
  });
});
