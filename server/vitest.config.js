import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Issue #53 — minimum coverage thresholds (v8 provider).  The
    // figures are intentionally low until the route-test backfill in
    // #15 lands; ratchet them up once we cross the next 10% line.
    // Requires `@vitest/coverage-v8` in devDeps to actually emit a
    // report; the npm-run-test step will tell you if it's missing.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 30,
        statements: 30,
        branches: 30,
        functions: 30,
      },
      // Skip the test helpers + one-shot migration scripts from the
      // coverage denominator — they're never expected to ship to prod
      // and would skew the ratio downward.
      exclude: [
        '__tests__/**',
        '**/__tests__/**',
        '**/*.test.js',
        'scripts/migrate*.js',
        'node_modules/**',
      ],
    },
  },
});
