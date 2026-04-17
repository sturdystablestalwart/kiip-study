'use strict';

const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/i;
const VALID_TYPES = new Set([
    'mcq-single',
    'mcq-multiple',
    'short-answer',
    'ordering',
    'fill-in-the-blank',
]);

/**
 * Validates a parsed JSON object returned by the Gemini LLM before it is
 * persisted to MongoDB.  Throws an Error with a descriptive message on any
 * violation.
 *
 * @param {unknown} parsed  — the result of JSON.parse(llmResponse)
 */
function validateLLMOutput(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('LLM output must be a JSON object');
    }

    // ── title ──────────────────────────────────────────────────────────────
    if (typeof parsed.title !== 'string' || parsed.title.length === 0) {
        throw new Error('LLM output: title must be a non-empty string');
    }
    if (parsed.title.length > 200) {
        throw new Error(
            `LLM output: title exceeds 200 characters (got ${parsed.title.length})`
        );
    }
    if (HTML_TAG_RE.test(parsed.title)) {
        throw new Error('LLM output: title contains HTML tags');
    }

    // ── questions ──────────────────────────────────────────────────────────
    if (!Array.isArray(parsed.questions)) {
        throw new Error('LLM output: questions must be an array');
    }
    if (parsed.questions.length === 0) {
        throw new Error('LLM output: questions array must not be empty');
    }
    if (parsed.questions.length > 50) {
        throw new Error(
            `LLM output: questions array exceeds 50 items (got ${parsed.questions.length})`
        );
    }

    parsed.questions.forEach((q, idx) => {
        const loc = `question[${idx}]`;

        if (!q || typeof q !== 'object') {
            throw new Error(`LLM output: ${loc} must be an object`);
        }

        // text
        if (typeof q.text !== 'string' || q.text.length === 0) {
            throw new Error(`LLM output: ${loc}.text must be a non-empty string`);
        }
        if (q.text.length > 2000) {
            throw new Error(
                `LLM output: ${loc}.text exceeds 2000 characters (got ${q.text.length})`
            );
        }
        if (HTML_TAG_RE.test(q.text)) {
            throw new Error(`LLM output: ${loc}.text contains HTML tags`);
        }

        // type (default to mcq-single if missing)
        if (q.type === undefined || q.type === null) {
            q.type = 'mcq-single';
        }
        if (!VALID_TYPES.has(q.type)) {
            throw new Error(
                `LLM output: ${loc}.type "${q.type}" is not a recognised question type`
            );
        }

        // explanation (optional)
        if (q.explanation !== undefined && q.explanation !== null) {
            if (typeof q.explanation !== 'string' || q.explanation.length === 0) {
                throw new Error(
                    `LLM output: ${loc}.explanation must be a non-empty string when present`
                );
            }
            if (q.explanation.length > 5000) {
                throw new Error(
                    `LLM output: ${loc}.explanation exceeds 5000 characters (got ${q.explanation.length})`
                );
            }
            if (HTML_TAG_RE.test(q.explanation)) {
                throw new Error(`LLM output: ${loc}.explanation contains HTML tags`);
            }
        }

        // image (optional)
        if (q.image !== undefined && q.image !== null) {
            if (typeof q.image !== 'string') {
                throw new Error(`LLM output: ${loc}.image must be a string when present`);
            }
            if (q.image.length > 200) {
                throw new Error(
                    `LLM output: ${loc}.image exceeds 200 characters (got ${q.image.length})`
                );
            }
        }

        // options (optional at schema level, but validate if present)
        if (q.options !== undefined && q.options !== null) {
            if (!Array.isArray(q.options)) {
                throw new Error(`LLM output: ${loc}.options must be an array`);
            }
            if (q.options.length > 10) {
                throw new Error(
                    `LLM output: ${loc}.options exceeds 10 items (got ${q.options.length})`
                );
            }
            q.options.forEach((opt, oidx) => {
                const oloc = `${loc}.options[${oidx}]`;
                if (!opt || typeof opt !== 'object') {
                    throw new Error(`LLM output: ${oloc} must be an object`);
                }
                // option text
                if (typeof opt.text !== 'string' || opt.text.length === 0) {
                    throw new Error(
                        `LLM output: ${oloc}.text must be a non-empty string`
                    );
                }
                if (opt.text.length > 500) {
                    throw new Error(
                        `LLM output: ${oloc}.text exceeds 500 characters (got ${opt.text.length})`
                    );
                }
                if (HTML_TAG_RE.test(opt.text)) {
                    throw new Error(`LLM output: ${oloc}.text contains HTML tags`);
                }
                // isCorrect must be a boolean, not a string
                if (typeof opt.isCorrect !== 'boolean') {
                    throw new Error(
                        `LLM output: ${oloc}.isCorrect must be a boolean (got ${typeof opt.isCorrect} "${opt.isCorrect}")`
                    );
                }
            });
        }
    });
}

module.exports = { validateLLMOutput };
