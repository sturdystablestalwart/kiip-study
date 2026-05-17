/**
 * Regression for issue #194:
 * Server/client/mongo services in docker-compose.yaml lacked `init: true`.
 * Without an init process, child processes spawned inside the container
 * (pdf-parse / sharp / papaparse in the server image, signal handling
 * for mongod, nginx workers in the client image) are not reaped on
 * SIGCHLD and can accumulate as zombies. Also delays clean SIGTERM
 * propagation.
 *
 * #93 covers caddy + backup; this issue covers the remaining three.
 *
 * Lock in: server, client, and mongo each declare `init: true`.
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

describe('docker-compose init:true on app services (#194)', () => {
  for (const svc of ['server', 'client', 'mongo']) {
    it(`${svc} declares init: true`, () => {
      const section = sectionFor(svc);
      expect(section, `${svc} service section must exist`).not.toBeNull();
      expect(section).toMatch(/^\s*init:\s*true\s*$/m);
    });
  }
});
