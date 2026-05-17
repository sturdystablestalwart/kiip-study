/**
 * Regression for issue #85:
 * docker-compose.yaml had healthchecks on mongo, server, and client but
 * NOT on caddy (the public-facing edge proxy — if it can't bind ports
 * or parse the Caddyfile, no monitor knows until traffic stops) and
 * NOT on backup (a `while sleep; do backup.sh; done` worker — silent
 * death == silent loss of backups).
 *
 * Lock in: every service declares a healthcheck block.
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

describe('docker-compose healthcheck on caddy + backup (#85)', () => {
  for (const svc of ['caddy', 'backup']) {
    it(`${svc} declares a healthcheck block`, () => {
      const section = sectionFor(svc);
      expect(section, `${svc} service section must exist`).not.toBeNull();
      expect(section).toMatch(/^\s*healthcheck:\s*$/m);
    });
  }
});
