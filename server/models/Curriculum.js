const mongoose = require('mongoose');

const UnitSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  titleKo: { type: String, required: true },
  titleEn: { type: String, required: true },
  section: { type: String, default: null },
  isReview: { type: Boolean, default: false }
}, { _id: false });

const CurriculumSchema = new mongoose.Schema({
  level: { type: String, required: true, unique: true },
  levelName: {
    ko: { type: String, required: true },
    en: { type: String, required: true }
  },
  hours: { type: Number },
  units: [UnitSchema]
});

module.exports = mongoose.model('Curriculum', CurriculumSchema);
