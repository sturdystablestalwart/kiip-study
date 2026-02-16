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
