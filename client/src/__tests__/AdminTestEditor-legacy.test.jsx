/**
 * Regression test for issue #115:
 * AdminTestEditor must not crash when a loaded test contains legacy questions
 * where `acceptedAnswers`, `blanks`, `options`, or `correctOrder` are undefined
 * (tests created by LLM generation, BulkImport, or predating schema additions).
 *
 * Crash sites in the buggy code:
 *   - `removeAcceptedAnswer` (line ~397): `q.acceptedAnswers.filter(...)`
 *   - blank chip remove handler (line ~627): `q2.blanks.map(...)`
 *
 * The fix normalizes question arrays on load, so every read sees [] instead
 * of undefined.
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

// --- Mocks (must come before importing AdminTestEditor) ---

const I18N_OBJ = {
  t: (key) => key,
  i18n: { changeLanguage: () => Promise.resolve() },
};
vi.mock('react-i18next', () => ({
  useTranslation: () => I18N_OBJ,
}));

const AUTH_OBJ = {
  user: { _id: 'admin1', isAdmin: true, displayName: 'Admin' },
  loading: false,
};
vi.mock('../context/AuthContext', () => ({
  useAuth: () => AUTH_OBJ,
}));

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();
vi.mock('../utils/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    patch: (...args) => apiPatchMock(...args),
  },
}));

import AdminTestEditor from '../pages/AdminTestEditor';

const renderEditor = (testId = 't1') =>
  render(
    <ThemeProvider theme={lightTheme}>
      <MemoryRouter initialEntries={[`/admin/tests/${testId}/edit`]}>
        <Routes>
          <Route path="/admin/tests/:id/edit" element={<AdminTestEditor />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

describe('AdminTestEditor: legacy questions with missing array fields (#115)', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPatchMock.mockReset();
  });

  it('does not crash when short-answer question has undefined acceptedAnswers and chip is removed', async () => {
    // Legacy short-answer with NO acceptedAnswers field at all (undefined).
    const legacyTest = {
      _id: 't1',
      title: 'Legacy test',
      questions: [
        {
          text: 'What is the capital of Korea?',
          type: 'short-answer',
          // acceptedAnswers: undefined  ← legacy
        },
      ],
    };

    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/api/curriculum')) return Promise.resolve({ data: [] });
      if (url.startsWith('/api/tests/t1')) return Promise.resolve({ data: legacyTest });
      return Promise.resolve({ data: {} });
    });

    renderEditor('t1');

    // Question card renders without crashing during initial render
    // (read of `(q.acceptedAnswers || []).map` site).
    const card = await screen.findByTestId('question-card');
    expect(card).toBeInTheDocument();

    // Add an answer then remove it. The remove handler is `removeAcceptedAnswer`
    // which executes `q.acceptedAnswers.filter(...)` against state. With the bug
    // (no normalization on load), the state's acceptedAnswers stays undefined
    // until something assigns it; addAcceptedAnswer is defensive with
    // `[...(q.acceptedAnswers || []), ...]`, so we can use it to seed an array
    // and then exercise the non-defensive removeAcceptedAnswer path. But the
    // crash we are guarding against is BEFORE that — anything that reads
    // `q.acceptedAnswers.X` directly. Demonstrate by adding an answer + removing.
    const input = screen.getByPlaceholderText('admin.editorPlaceholder.answerEnter');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Seoul' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(screen.getByText('Seoul')).toBeInTheDocument();

    // Click the chip remove (×). The chip's × is a button INSIDE the chip
    // (which contains the text "Seoul"), as opposed to the question delete-×
    // which is the dedicated DeleteQBtn. Find the × that is a sibling of "Seoul".
    const seoulChip = screen.getByText('Seoul');
    const removeChip = seoulChip.querySelector('button');
    expect(removeChip).toBeTruthy();
    await act(async () => {
      fireEvent.click(removeChip);
    });

    expect(screen.queryByText('Seoul')).not.toBeInTheDocument();
  });

  it('does not crash when a fill-in-the-blank question has undefined blanks (#115 line 627)', async () => {
    // Legacy fill-in-the-blank with no blanks array.
    const legacyTest = {
      _id: 't2',
      title: 'Legacy FITB test',
      questions: [
        {
          text: 'The ___ is red.',
          type: 'fill-in-the-blank',
          // blanks: undefined  ← legacy
        },
      ],
    };

    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/api/curriculum')) return Promise.resolve({ data: [] });
      if (url.startsWith('/api/tests/t2')) return Promise.resolve({ data: legacyTest });
      return Promise.resolve({ data: {} });
    });

    renderEditor('t2');

    // Render must not crash — `(q.blanks || []).map(...)` site.
    const card = await screen.findByTestId('question-card');
    expect(card).toBeInTheDocument();

    // Click "+ Add blank".
    // Button text is now the i18n key after #116; mock t() returns the key verbatim.
    const addBlankBtn = screen.getByRole('button', { name: /addBlank/ });
    await act(async () => {
      fireEvent.click(addBlankBtn);
    });

    // Add an answer for the new blank — its onKeyDown reads `q2.blanks.map(...)`
    // (line ~648). With normalization fix, q2.blanks is [] when loaded and grew
    // to [{acceptedAnswers:[]}] from the previous click. Without the fix at that
    // line specifically, the .map and the inner `[...b.acceptedAnswers, val]`
    // could still crash if acceptedAnswers was undefined inside the blank.
    const blankInput = screen.getByPlaceholderText('admin.editorPlaceholder.answerEnter');
    await act(async () => {
      fireEvent.change(blankInput, { target: { value: 'rose' } });
      fireEvent.keyDown(blankInput, { key: 'Enter', code: 'Enter' });
    });

    expect(screen.getByText('rose')).toBeInTheDocument();

    // Remove the chip — hits the buggy `q2.blanks.map(...)` and
    // `b.acceptedAnswers.filter(...)` path at line 627.
    const roseChip = screen.getByText('rose');
    const removeChipBtn = roseChip.querySelector('button');
    expect(removeChipBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(removeChipBtn);
    });

    expect(screen.queryByText('rose')).not.toBeInTheDocument();
  });

  it('does not crash when MCQ question has undefined options', async () => {
    const legacyTest = {
      _id: 't3',
      title: 'Legacy MCQ',
      questions: [
        {
          text: 'Pick one',
          type: 'mcq-single',
          // options: undefined  ← legacy
        },
      ],
    };

    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/api/curriculum')) return Promise.resolve({ data: [] });
      if (url.startsWith('/api/tests/t3')) return Promise.resolve({ data: legacyTest });
      return Promise.resolve({ data: {} });
    });

    renderEditor('t3');

    const card = await screen.findByTestId('question-card');
    expect(card).toBeInTheDocument();

    // Add an option — uses [...q.options, ...]. Must not crash.
    // Button text is now the i18n key after #116; mock t() returns the key verbatim.
    const addOptionBtn = screen.getByRole('button', { name: /addOption/ });
    await act(async () => {
      fireEvent.click(addOptionBtn);
    });

    await waitFor(() => {
      // Placeholder is now interpolated from `admin.editorPlaceholder.option`
      // with {n: 1}; mock t() formats opts.count but doesn't substitute {n}, so
      // the literal key with placeholder markers comes through.
      expect(screen.getByPlaceholderText(/editorPlaceholder.option/)).toBeInTheDocument();
    });
  });
});
