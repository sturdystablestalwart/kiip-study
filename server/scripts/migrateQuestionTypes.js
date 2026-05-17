// ONE-TIME MIGRATION (issue #11)
// Status: completed against production. Renames legacy
// `questions.type === 'multiple-choice'` → `'mcq-single'`.  Idempotent
// re-runs are no-ops, but accidental re-runs are still confusing — so
// the script refuses unless MIGRATE_CONFIRM=YES is set.
// See ops/MIGRATIONS.md for the full runbook.
if (process.env.MIGRATE_CONFIRM !== 'YES') {
    console.error(
        'REFUSING TO RUN: this migration was completed on 2026-04-XX.\n' +
        'If you genuinely need to re-run, set MIGRATE_CONFIRM=YES.\n' +
        'See ops/MIGRATIONS.md for context.'
    );
    process.exit(2);
}

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kiip_test_app');
  console.log('Connected to MongoDB');

  const result = await mongoose.connection.db.collection('tests').updateMany(
    { 'questions.type': 'multiple-choice' },
    { $set: { 'questions.$[elem].type': 'mcq-single' } },
    { arrayFilters: [{ 'elem.type': 'multiple-choice' }] }
  );

  console.log(`Updated ${result.modifiedCount} test documents`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
