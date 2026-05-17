/**
 * Regression for issues #194 + #93:
 * All five services in docker-compose.yaml must declare `init: true`.
 * Without an init process, child processes spawned inside containers
 * (pdf-parse/sharp/papaparse in server, mongod workers, nginx workers
 * in client, certificate-management children in caddy, shell pipelines
 * in backup) are not reaped on SIGCHLD and accumulate as zombies. Also
 * delays clean SIGTERM propagation.
 *
 * #194 covers server/client/mongo; #93 covers caddy + backup. Locked in
 * together here.
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

describe('docker-compose init:true on all services (#194 + #93)', () => {
  for (const svc of ['server', 'client', 'mongo', 'caddy', 'backup']) {
    it(`${svc} declares init: true`, () => {
      const section = sectionFor(svc);
      expect(section, `${svc} service section must exist`).not.toBeNull();
      expect(section).toMatch(/^\s*init:\s*true\s*$/m);
    });
  }
});
