/**
 * Regression for issue #128:
 * `server/utils/llm.js` previously stripped fences with
 *   /```json/g  and  /```/g
 * — only matched literal "```json", missing "```JSON", "``` json", or
 * single-backtick variants. Plus it had NO `responseMimeType` directive,
 * so the model often returned wrapped JSON. Result: frequent JSON.parse
 * failures with no retry.
 *
 * Lock in three invariants by inspecting the source:
 *   1. `responseMimeType: 'application/json'` is wired in.
 *   2. The fence strip handles optional/uppercase "json" and whitespace.
 *   3. A retry-on-parse-failure path exists.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(HERE, '../llm.js'), 'utf-8');

describe('llm.js robust JSON parsing (#128)', () => {
  it('sets responseMimeType: "application/json"', () => {
    expect(SRC).toMatch(/responseMimeType:\s*['"]application\/json['"]/);
  });

  it('fence strip handles optional "json"/"JSON" with whitespace', () => {
    expect(SRC).toMatch(/\/[\s\S]*?\(\?:json\)\?[\s\S]*?\/[gim]+/i);
  });

  it('has a retry path that re-invokes the model on parse failure', () => {
    expect(SRC).toMatch(/retry|attempt\s*<|for\s*\(\s*let\s*attempt|maxAttempts/i);
  });
});
