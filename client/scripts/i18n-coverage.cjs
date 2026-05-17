#!/usr/bin/env node
/**
 * i18n coverage check (issue #34).
 *
 * Loads every locale bundle under client/src/i18n/locales/<lang>/common.json,
 * uses English as the canonical key set, and reports per-locale missing
 * keys, extra keys, and overall coverage %.
 *
 * Exits non-zero if any locale falls below COVERAGE_MIN (env var; default 95).
 *
 * Wire from package.json:  "i18n:check": "node scripts/i18n-coverage.js"
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const CANONICAL = 'en';
const COVERAGE_MIN = Number(process.env.COVERAGE_MIN ?? 95);

function flatten(obj, prefix = '') {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            Object.assign(out, flatten(v, key));
        } else {
            out[key] = v;
        }
    }
    return out;
}

function loadLocale(lang) {
    const file = path.join(LOCALES_DIR, lang, 'common.json');
    if (!fs.existsSync(file)) return null;
    return flatten(JSON.parse(fs.readFileSync(file, 'utf8')));
}

const langs = fs.readdirSync(LOCALES_DIR).filter((d) =>
    fs.statSync(path.join(LOCALES_DIR, d)).isDirectory(),
);

const canonical = loadLocale(CANONICAL);
if (!canonical) {
    console.error(`Canonical locale "${CANONICAL}" not found at ${LOCALES_DIR}/${CANONICAL}/common.json`);
    process.exit(1);
}
const canonicalKeys = new Set(Object.keys(canonical));

let worstCoverage = 100;
let anyFail = false;
const lines = [];

for (const lang of langs) {
    const bundle = loadLocale(lang);
    if (!bundle) continue;
    const bundleKeys = new Set(Object.keys(bundle));
    const missing = [...canonicalKeys].filter((k) => !bundleKeys.has(k));
    const extra = [...bundleKeys].filter((k) => !canonicalKeys.has(k));
    const coverage = (1 - missing.length / canonicalKeys.size) * 100;
    if (coverage < worstCoverage) worstCoverage = coverage;

    const ok = coverage >= COVERAGE_MIN ? 'PASS' : 'FAIL';
    if (ok === 'FAIL') anyFail = true;

    lines.push(
        `[${ok}] ${lang.padEnd(4)} coverage=${coverage.toFixed(1).padStart(5)}%  ` +
        `missing=${missing.length.toString().padStart(3)}  extra=${extra.length.toString().padStart(3)}`,
    );

    if (missing.length && missing.length <= 20) {
        for (const k of missing) lines.push(`         missing → ${k}`);
    } else if (missing.length) {
        for (const k of missing.slice(0, 10)) lines.push(`         missing → ${k}`);
        lines.push(`         …and ${missing.length - 10} more`);
    }
}

console.log(`i18n coverage (canonical = ${CANONICAL}, threshold = ${COVERAGE_MIN}%)`);
console.log('-----------------------------------------------------------------');
for (const l of lines) console.log(l);
console.log('-----------------------------------------------------------------');
console.log(`Worst coverage: ${worstCoverage.toFixed(1)}%`);

process.exit(anyFail ? 1 : 0);
