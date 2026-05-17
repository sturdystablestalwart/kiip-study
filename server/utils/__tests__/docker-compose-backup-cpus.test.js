/**
 * Regression for issue #90:
 * The backup service had `mem_limit` but NO `cpus:` cap. `mongodump`
 * saturates a CPU during dump windows, starving the live server/mongo
 * containers on a multi-core host.
 *
 * Lock in: backup service declares a `cpus:` constraint.
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

describe('backup service cpus constraint (#90)', () => {
  it('backup declares a cpus: cap', () => {
    const section = sectionFor('backup');
    expect(section).not.toBeNull();
    expect(section).toMatch(/^\s*cpus:\s*['"]?\d+(\.\d+)?['"]?\s*$/m);
  });
});
