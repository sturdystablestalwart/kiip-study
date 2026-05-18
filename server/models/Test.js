const mongoose = require('mongoose');

// Issue #452 — subdocs have no _id consumer; scoring + admin editor
// address by array index. Disable auto-_id to save ~12 bytes per
// subdoc (a 20-question × 4-option test was ~960 wasted bytes).
const OptionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isCorrect: { type: Boolean, required: true, default: false }
}, { _id: false });

const BlankSchema = new mongoose.Schema({
    acceptedAnswers: [{ type: String }]
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    image: { type: String },
    options: [OptionSchema],
    explanation: { type: String },
    type: { type: String, enum: ['mcq-single', 'mcq-multiple', 'short-answer', 'ordering', 'fill-in-the-blank'], default: 'mcq-single' },
    acceptedAnswers: [{ type: String }],
    correctOrder: [{ type: Number }],
    blanks: [BlankSchema]
}, { _id: false });

const TestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    contentType: {
        type: String,
        enum: ['mock-exam', 'topic-drill', 'vocabulary', 'grammar', 'general'],
        default: 'general'
    },
    source: {
        type: String,
        enum: ['ai-generated', 'file-upload', 'manual-import', 'auto-imported', 'bulk-import'],
        default: 'ai-generated'
    },
    description: { type: String },
    level: {
        type: String,
        enum: ['0', '1', '2', '3', '4', '5-basic', '5-advanced']
    },
    unitNumber: { type: Number },
    section: { type: String },
    shareId: { type: String, unique: true, sparse: true },
    questions: [QuestionSchema],
    createdAt: { type: Date, default: Date.now }
});

// Full-text search index on title, description
TestSchema.index({ title: 'text', description: 'text' });

// Compound index for filtering + sorting
TestSchema.index({ level: 1, unitNumber: 1, contentType: 1, createdAt: -1 });

// Compound index for cursor pagination by (createdAt desc, _id desc)
TestSchema.index({ createdAt: -1, _id: -1 });

// Issue #136 — exact-match lookup by `title` is used by autoImporter
// to skip already-imported files; without a single-field index this
// was a collection scan at every boot once the library grew past a
// few hundred tests.  The text index on title is separate (full-text
// search) and doesn't satisfy exact-match queries.
TestSchema.index({ title: 1 });

module.exports = mongoose.model('Test', TestSchema);
