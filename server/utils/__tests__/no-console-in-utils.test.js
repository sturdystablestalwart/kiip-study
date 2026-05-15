import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Regression guard for issues #5 and #17 (epic #215): server/utils/* must use
// pino logger, never raw console.*. CLAUDE.md explicitly forbids console.* in
// server/utils/ and server/routes/.
const files = [
    resolve(__dirname, '../autoImporter.js'),
    resolve(__dirname, '../magicLinkEmail.js'),
];

describe('no console.* calls in migrated server/utils files', () => {
    for (const file of files) {
        it(`${file.split(/[\\/]/).pop()} contains no console.{log,warn,error,info,debug} calls`, () => {
            const source = readFileSync(file, 'utf-8');
            // Strip line comments and block comments so we ignore the word
            // "console" appearing in commentary, not in actual call sites.
            const stripped = source
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/(^|[^:])\/\/.*$/gm, '$1');
            const match = stripped.match(/\bconsole\s*\.\s*(log|warn|error|info|debug)\s*\(/);
            expect(match, `Found ${match && match[0]} in ${file}`).toBeNull();
        });
    }
});
