/**
 * Regression test for issue #114.
 *
 * On a cold load of `/test/:id` by an authenticated user, AuthContext's
 * `/api/auth/me` request may still be in flight at mount, so `useAuth().user`
 * is initially `null`. Before the fix, the session-start `POST /api/sessions/start`
 * was nested inside the test-fetch effect with dep array `[id]` — when `user`
 * later populated, the effect never re-ran and the session was never created.
 *
 * This test simulates the null -> populated transition and asserts the
 * session-start POST fires once `user` becomes available.
 */

import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

// Mock the api module before importing the component under test.
vi.mock('../utils/api', () => {
  const get = vi.fn();
  const post = vi.fn();
  const patch = vi.fn();
  return {
    default: { get, post, patch },
  };
});

// Mock useAuth so we can control the user transition deterministically.
let mockAuth = { user: null, loading: true, logout: vi.fn(), refreshUser: vi.fn() };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }) => children,
}));

// i18n: stub useTranslation so we don't load the real i18n stack.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key, fallback) => fallback || _key, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import api from '../utils/api';
import TestTaker from '../pages/TestTaker';

const TEST_ID = 'abc123';

const sampleTest = {
  _id: TEST_ID,
  title: 'Sample Test',
  contentType: 'kiip',
  source: 'official',
  level: 2,
  questions: [
    {
      type: 'mcq-single',
      questionText: 'Q1?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0,
    },
  ],
};

const renderTestTaker = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <MemoryRouter initialEntries={[`/test/${TEST_ID}`]}>
        <Routes>
          <Route path="/test/:id" element={<TestTaker />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

describe('TestTaker — session creation on cold-load with delayed auth (issue #114)', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
    mockAuth = { user: null, loading: true, logout: vi.fn(), refreshUser: vi.fn() };

    api.get.mockResolvedValue({ data: sampleTest });
    api.post.mockResolvedValue({
      data: { session: { _id: 'session-1', answers: [] }, resumed: false },
    });
    api.patch.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it('creates a TestSession after user transitions from null to authenticated', async () => {
    const { rerender } = renderTestTaker();

    // Wait for the test fetch to complete (user is still null → no session POST yet).
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `/api/tests/${TEST_ID}`,
        expect.any(Object)
      );
    });

    // No session POST yet — auth still loading, user is null.
    expect(api.post).not.toHaveBeenCalled();

    // Now AuthContext finishes /api/auth/me and the user populates.
    mockAuth = {
      user: { _id: 'u1', email: 'a@b.com', displayName: 'Alex' },
      loading: false,
      logout: vi.fn(),
      refreshUser: vi.fn(),
    };

    // Force a re-render so the new auth value flows in.
    rerender(
      <ThemeProvider theme={lightTheme}>
        <MemoryRouter initialEntries={[`/test/${TEST_ID}`]}>
          <Routes>
            <Route path="/test/:id" element={<TestTaker />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    );

    // After user populates, the session-start POST should fire.
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/sessions/start',
        expect.objectContaining({ testId: TEST_ID }),
        expect.any(Object)
      );
    });

    // And only once — the effect is one-shot per (user, sessionId).
    const startCalls = api.post.mock.calls.filter(
      ([url]) => url === '/api/sessions/start'
    );
    expect(startCalls).toHaveLength(1);
  });

  it('does not create a session for anonymous users (user stays null)', async () => {
    renderTestTaker();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `/api/tests/${TEST_ID}`,
        expect.any(Object)
      );
    });

    // Give the event loop a tick to confirm no POST fires.
    await new Promise(r => setTimeout(r, 50));

    const startCalls = api.post.mock.calls.filter(
      ([url]) => url === '/api/sessions/start'
    );
    expect(startCalls).toHaveLength(0);
  });

  it('creates the session immediately when user is already populated at mount', async () => {
    mockAuth = {
      user: { _id: 'u1', email: 'a@b.com', displayName: 'Alex' },
      loading: false,
      logout: vi.fn(),
      refreshUser: vi.fn(),
    };

    renderTestTaker();

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/sessions/start',
        expect.objectContaining({ testId: TEST_ID }),
        expect.any(Object)
      );
    });
  });
});
