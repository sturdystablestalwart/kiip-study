// Issue #8 — pins the announcement thresholds for TestTaker's timer
// aria-live region.  Tests the pure helper so we don't need to render
// the (heavy) TestTaker page just to validate the time→key mapping.
import { describe, test, expect } from 'vitest';
import { announcementKeyForTime } from '../utils/timerAnnouncement';

describe('announcementKeyForTime (#8)', () => {
    test('fires at exactly 10 minutes remaining', () => {
        expect(announcementKeyForTime(600, false)).toBe('tenMinutes');
    });
    test('fires at exactly 5 minutes remaining', () => {
        expect(announcementKeyForTime(300, false)).toBe('fiveMinutes');
    });
    test('fires at exactly 1 minute remaining', () => {
        expect(announcementKeyForTime(60, false)).toBe('oneMinute');
    });
    test('fires at exactly 30 seconds remaining', () => {
        expect(announcementKeyForTime(30, false)).toBe('thirtySeconds');
    });
    test('fires at expiration (0 seconds, not-yet-expired)', () => {
        expect(announcementKeyForTime(0, false)).toBe('expired');
    });
    test('does NOT re-fire "expired" once the timer flag is set', () => {
        expect(announcementKeyForTime(0, true)).toBeNull();
    });
    test.each([1800, 1799, 601, 599, 301, 299, 61, 59, 31, 29, 1])(
        'returns null at non-threshold time %d',
        (t) => {
            expect(announcementKeyForTime(t, false)).toBeNull();
        }
    );
});
