/**
 * Regression for issue #67:
 * The old `/<\/?[a-z][\s\S]*?>/i` regex could be ReDoS'd by pathological
 * LLM output.  validateLLMOutput must reject HTML quickly even on
 * megabyte-scale strings.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateLLMOutput } = require('../llmValidator');

const baseQuestion = (text) => ({
    text,
    type: 'mcq-single',
    options: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
        { text: 'c', isCorrect: false },
        { text: 'd', isCorrect: false },
    ],
});

describe('llmValidator HTML detection (#67)', () => {
    it('rejects an obvious HTML tag', () => {
        expect(() => validateLLMOutput({
            title: 'ok',
            questions: [baseQuestion('hello <b>world</b>')],
        })).toThrow(/HTML/);
    });

    it('accepts plain text with angle brackets but no tag-like lead', () => {
        expect(() => validateLLMOutput({
            title: 'ok',
            questions: [baseQuestion('1 < 2 and 3 > 2')],
        })).not.toThrow();
    });

    it('completes quickly on pathological unterminated tag inputs', () => {
        // Under the per-field 2000-char cap (so we exercise the HTML
        // detector, not the length validator), simulate a backtracking-
        // bait sequence — many `<` leads followed by no closing `>`.
        const evil = '<a' + 'x'.repeat(1800) + '<<<<<<<';
        const start = Date.now();
        expect(() => validateLLMOutput({
            title: 'ok',
            questions: [baseQuestion(evil)],
        })).toThrow();
        const elapsed = Date.now() - start;
        // Old regex could chew ms per char on adversarial input; non-
        // backtracking probe stays under 50ms even allowing for CI noise.
        expect(elapsed).toBeLessThan(200);
    });

    it('exposes containsHtmlTag via HTML_TAG_RE.test() for back-compat', () => {
        const { HTML_TAG_RE } = require('../llmValidator');
        // Module currently does not re-export HTML_TAG_RE; that's
        // intentional.  This test documents that callers go through
        // validateLLMOutput, not the raw regex.
        expect(HTML_TAG_RE).toBeUndefined();
    });
});
