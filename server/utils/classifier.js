const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const Curriculum = require('../models/Curriculum');
const logger = require('./logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'missing');

// ── Cached taxonomy string (1-hour TTL) ──
let cachedTaxonomy = null;
let cachedLevels = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getTaxonomy() {
    if (cachedTaxonomy && (Date.now() - cachedAt < CACHE_TTL_MS)) {
        return { taxonomyStr: cachedTaxonomy, curriculum: cachedLevels };
    }

    const curriculum = await Curriculum.find({}).lean();
    if (!curriculum.length) return { taxonomyStr: null, curriculum: [] };

    cachedLevels = curriculum;
    cachedAt = Date.now();
    cachedTaxonomy = curriculum.map(c =>
        `${c.level} — ${c.levelName.ko} (${c.levelName.en}):\n` +
        c.units.map(u =>
            `  ${u.number}: ${u.titleKo}${u.section ? ` [${u.section}]` : ''}`
        ).join('\n')
    ).join('\n\n');

    return { taxonomyStr: cachedTaxonomy, curriculum };
}

// ── Stratified sampling: pick from beginning, middle, end ──
function sampleQuestions(questions, total = 9) {
    const len = questions.length;
    if (len <= total) return [...questions]; // short tests: use all, no overlap

    const perBucket = Math.floor(total / 3);
    const third = Math.floor(len / 3);

    const start = questions.slice(0, perBucket);
    const middle = questions.slice(third, third + perBucket);
    const end = questions.slice(len - perBucket);

    return [...start, ...middle, ...end];
}

// ── Response schema for Gemini structured output ──
const classificationSchema = {
    type: SchemaType.OBJECT,
    properties: {
        level: {
            type: SchemaType.STRING,
            description: 'KIIP level code',
            enum: ['0', '1', '2', '3', '4', '5-basic', '5-advanced']
        },
        unitNumber: {
            type: SchemaType.NUMBER,
            description: 'Unit number within the level, or -1 if spanning multiple units',
            nullable: true
        },
        section: {
            type: SchemaType.STRING,
            description: 'Section name for level 5 only (사회/교육/문화/정치/경제/법/역사/지리), or empty',
            nullable: true
        },
        contentType: {
            type: SchemaType.STRING,
            description: 'Type of test content',
            enum: ['mock-exam', 'topic-drill', 'vocabulary', 'grammar', 'general']
        }
    },
    required: ['level', 'contentType']
};

/**
 * Classify a test by analyzing its questions and title against the KIIP curriculum.
 * Returns { level, unitNumber, section, contentType }
 */
async function classifyTest(questions, title) {
    const { taxonomyStr, curriculum } = await getTaxonomy();
    if (!taxonomyStr) {
        logger.warn('No curriculum data found — skipping classification');
        return { level: null, unitNumber: null, section: null, contentType: 'general' };
    }

    // Stratified sample: 3 from start, 3 from middle, 3 from end
    const sampled = sampleQuestions(questions, 9);
    const questionSample = sampled.map((q, i) => {
        const optionsStr = q.options?.length
            ? ' [' + q.options.map(o => o.text).join(' / ') + ']'
            : '';
        return `${i + 1}. ${q.text}${optionsStr}`;
    }).join('\n');

    const prompt = `You are a KIIP (사회통합프로그램) curriculum classification expert.

Classify this Korean language test into the correct KIIP level, unit, and content type.

TEST TITLE: ${title}

SAMPLE QUESTIONS (${sampled.length} of ${questions.length} total, sampled from beginning/middle/end):
${questionSample}

KIIP CURRICULUM:
${taxonomyStr}

RULES:
- Level 0: Hangul only. Levels 1-2: beginner. 3-4: intermediate. 5: Korean society knowledge.
- Match by TOPIC first, then GRAMMAR PATTERNS.
- unitNumber = specific unit if focused on one topic; -1 if spanning multiple units (mock exam).
- contentType: "mock-exam" = 15+ questions across topics; "topic-drill" = single topic; "vocabulary"/"grammar" = focused drills.
- section: only for level 5 (사회/교육/문화/정치/경제/법/역사/지리), otherwise empty.`;

    // Attempt classification with structured output, retry once on failure
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: classificationSchema
                }
            });

            const result = await model.generateContent(prompt);
            const parsed = JSON.parse(result.response.text());

            // Validate level against curriculum
            const validLevels = curriculum.map(c => c.level);
            if (!validLevels.includes(parsed.level)) {
                logger.warn({ parsed }, 'Classifier returned invalid level');
                parsed.level = null;
            }

            // Normalize unitNumber: -1 or null → null
            if (parsed.unitNumber == null || parsed.unitNumber === -1) {
                parsed.unitNumber = null;
            }

            // Validate unitNumber against curriculum
            if (parsed.level && parsed.unitNumber != null) {
                const levelDoc = curriculum.find(c => c.level === parsed.level);
                const validUnits = levelDoc?.units.map(u => u.number) || [];
                if (!validUnits.includes(parsed.unitNumber)) {
                    logger.warn({ parsed }, 'Classifier returned invalid unitNumber');
                    parsed.unitNumber = null;
                }
            }

            // Validate contentType
            const validTypes = ['mock-exam', 'topic-drill', 'vocabulary', 'grammar', 'general'];
            if (!validTypes.includes(parsed.contentType)) {
                parsed.contentType = 'general';
            }

            // Clear section for non-level-5
            if (!parsed.level || !parsed.level.startsWith('5')) {
                parsed.section = null;
            }

            const result = {
                level: parsed.level || null,
                unitNumber: parsed.unitNumber ?? null,
                section: parsed.section || null,
                contentType: parsed.contentType
            };
            logger.info({ title, result }, 'Test classified');
            return result;
        } catch (err) {
            if (attempt === 0) {
                logger.warn({ err }, 'Classification attempt 1 failed, retrying...');
                continue;
            }
            logger.error({ err }, 'Test classification failed after 2 attempts');
            return { level: null, unitNumber: null, section: null, contentType: 'general' };
        }
    }
}

module.exports = { classifyTest };
