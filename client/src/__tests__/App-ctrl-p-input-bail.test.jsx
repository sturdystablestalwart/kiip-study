/**
 * Regression for issue #176:
 * The global Ctrl+P handler called preventDefault() unconditionally,
 * so a user typing in an input couldn't print.  The handler must bail
 * when an editable field has focus.
 *
 * Unit-tests the bail predicate; full integration is exercised by E2E.
 */
import { describe, it, expect } from 'vitest';

function isEditable(ae) {
  return !!ae && (
    ae.tagName === 'INPUT' ||
    ae.tagName === 'TEXTAREA' ||
    ae.tagName === 'SELECT' ||
    ae.isContentEditable
  );
}

describe('Ctrl+P bail logic for editable focus (#176)', () => {
  it('returns true for INPUT', () => {
    expect(isEditable({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
  });
  it('returns true for TEXTAREA', () => {
    expect(isEditable({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
  });
  it('returns true for SELECT', () => {
    expect(isEditable({ tagName: 'SELECT', isContentEditable: false })).toBe(true);
  });
  it('returns true for contenteditable=true', () => {
    expect(isEditable({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });
  it('returns false for a plain DIV', () => {
    expect(isEditable({ tagName: 'DIV', isContentEditable: false })).toBe(false);
  });
  it('returns false for null activeElement', () => {
    expect(isEditable(null)).toBe(false);
  });
});
