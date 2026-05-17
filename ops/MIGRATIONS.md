# Data Migrations

One-time migration scripts that have been run against production.  All
scripts in `server/scripts/migrate*.js` refuse to run unless
`MIGRATE_CONFIRM=YES` is set, so a new contributor who accidentally
executes one gets a hard refusal instead of a destructive re-run.

| Script | Purpose | Last run | Notes |
|--------|---------|----------|-------|
| `server/scripts/migrateQuestionTypes.js` | Rename legacy `questions.type === 'multiple-choice'` → `'mcq-single'` on existing Test docs. | 2026-04-XX (prod) | Idempotent — re-runs are no-ops, but still refuses without `MIGRATE_CONFIRM=YES`. |
| `server/scripts/migrateLegacyTests.js`  | Map old `category` field → `source` enum; map `"Level 2"` strings → `"2"` enum; back-fill `contentType` via Gemini classifier; remove `category` + `unit` fields. | 2026-04-XX (prod) | NOT idempotent (LLM classification varies). Re-running on an already-migrated DB will reclassify everything. Avoid. |
| `server/scripts/backfillAuthMethods.js` | Compute `authMethods` array from `googleId` / magic-link records.  Per-environment one-time. | 2026-04-XX (prod) | Safe to re-run; idempotent. |

## Run procedure

1. Take a Mongo backup first.  `ops/backup.sh` produces a `.tar.gz` snapshot.
2. Export `MIGRATE_CONFIRM=YES` in the shell where you'll invoke the script.
3. Run:
   ```
   cd server
   MIGRATE_CONFIRM=YES node scripts/<name>.js
   ```
4. Capture the script's stdout into the PR / runbook entry as the verified outcome.

## When to retire a script

Once a script has been run against every long-lived environment (prod,
staging, your laptop's local Mongo) you can move it under
`docs/migrations/<date>-<name>.md` as an embedded code block and delete
the `.js`.  Until then the guard above is sufficient — leaving the
`.js` in tree means the migration is reproducible from git history if
we ever need to roll a new environment forward through every historical
schema change.
