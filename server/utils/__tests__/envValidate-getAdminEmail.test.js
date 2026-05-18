// Issue #439 — getAdminEmail() returns ADMIN_EMAIL trimmed + lowercased
// so a mixed-case env value doesn't silently deny admin grant when
// compared against passport's lowercase email.

import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

const originalEnv = process.env.ADMIN_EMAIL;

afterEach(() => {
    if (originalEnv === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalEnv;
});

describe('Issue #439 — getAdminEmail() env normalization', () => {
    it('lowercases mixed-case ADMIN_EMAIL', () => {
        process.env.ADMIN_EMAIL = 'Admin@Example.com';
        const { getAdminEmail } = requireCJS('../envValidate.js');
        expect(getAdminEmail()).toBe('admin@example.com');
    });

    it('trims whitespace', () => {
        process.env.ADMIN_EMAIL = '  admin@example.com  ';
        const { getAdminEmail } = requireCJS('../envValidate.js');
        expect(getAdminEmail()).toBe('admin@example.com');
    });

    it('returns empty string when ADMIN_EMAIL unset (does not crash)', () => {
        delete process.env.ADMIN_EMAIL;
        const { getAdminEmail } = requireCJS('../envValidate.js');
        expect(getAdminEmail()).toBe('');
    });

    it('lowercase env value is unchanged', () => {
        process.env.ADMIN_EMAIL = 'admin@example.com';
        const { getAdminEmail } = requireCJS('../envValidate.js');
        expect(getAdminEmail()).toBe('admin@example.com');
    });
});
