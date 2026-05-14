import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Unit tests for the timeout-bounded PDF generation helper (issue #50).
//
// We mock the synchronous renderer (generateTestPdf) so we can independently
// drive the resolve/reject paths: successful flush, doc 'error', synchronous
// render throw, and timeout. No real pdfkit doc is required.

import * as pdfGen from '../../utils/pdfGenerator';

const { generateTestPdfWithTimeout, DEFAULT_PDF_TIMEOUT_MS } = pdfGen;

// ── Test doubles ─────────────────────────────────────────────────────────────

function makeFakeDoc() {
    const doc = new EventEmitter();
    doc.end = vi.fn();
    doc.destroy = vi.fn();
    doc.pipe = vi.fn();
    return doc;
}

function makeFakeRes() {
    const res = new EventEmitter();
    res.headersSent = false;
    return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DEFAULT_PDF_TIMEOUT_MS', () => {
    it('is 30 seconds', () => {
        expect(DEFAULT_PDF_TIMEOUT_MS).toBe(30_000);
    });
});

describe('generateTestPdfWithTimeout — happy path', () => {
    let renderSpy;

    beforeEach(() => {
        renderSpy = vi.spyOn(pdfGen, 'generateTestPdf').mockImplementation(() => {});
    });

    afterEach(() => {
        renderSpy.mockRestore();
    });

    it('resolves when the response emits finish', async () => {
        const doc = makeFakeDoc();
        const res = makeFakeRes();

        const p = generateTestPdfWithTimeout(doc, res, { questions: [] }, {}, 5000);

        // simulate pdfkit finishing
        setImmediate(() => res.emit('finish'));

        await expect(p).resolves.toBeUndefined();
        expect(doc.end).toHaveBeenCalledTimes(1);
    });

    it('resolves when the response emits close (client abort)', async () => {
        const doc = makeFakeDoc();
        const res = makeFakeRes();

        const p = generateTestPdfWithTimeout(doc, res, { questions: [] }, {}, 5000);
        setImmediate(() => res.emit('close'));

        await expect(p).resolves.toBeUndefined();
    });
});

describe('generateTestPdfWithTimeout — timeout path', () => {
    let renderSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        renderSpy = vi.spyOn(pdfGen, 'generateTestPdf').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        renderSpy.mockRestore();
    });

    it('rejects with code PDF_TIMEOUT after timeoutMs elapses', async () => {
        const doc = makeFakeDoc();
        const res = makeFakeRes();

        const p = generateTestPdfWithTimeout(doc, res, { questions: [] }, {}, 1000);
        const caught = p.catch((err) => err);

        vi.advanceTimersByTime(1001);

        const err = await caught;
        expect(err).toBeInstanceOf(Error);
        expect(err.code).toBe('PDF_TIMEOUT');
        expect(err.message).toMatch(/timed out/i);
        expect(doc.destroy).toHaveBeenCalledTimes(1);
    });
});

describe('generateTestPdfWithTimeout — error paths', () => {
    let renderSpy;

    afterEach(() => {
        if (renderSpy) renderSpy.mockRestore();
    });

    it('rejects when the synchronous renderer throws', async () => {
        renderSpy = vi.spyOn(pdfGen, 'generateTestPdf').mockImplementation(() => {
            throw new Error('synthetic render failure');
        });

        const doc = makeFakeDoc();
        const res = makeFakeRes();

        await expect(
            generateTestPdfWithTimeout(doc, res, { questions: [] }, {}, 5000)
        ).rejects.toThrow(/synthetic render failure/);
    });

    it('rejects when the doc emits an error event', async () => {
        renderSpy = vi.spyOn(pdfGen, 'generateTestPdf').mockImplementation(() => {});

        const doc = makeFakeDoc();
        const res = makeFakeRes();

        const p = generateTestPdfWithTimeout(doc, res, { questions: [] }, {}, 5000);
        setImmediate(() => doc.emit('error', new Error('pdfkit blew up')));

        await expect(p).rejects.toThrow(/pdfkit blew up/);
    });
});
