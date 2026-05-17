import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Issue #163 — single shared admin gate.
 *
 * Replaces the per-page pattern:
 *   if (!authLoading && !user?.isAdmin) navigate('/');
 *   if (authLoading || !user?.isAdmin) return null;
 *
 * Usage:
 *   const ready = useRequireAdmin();
 *   if (!ready) return null;
 *
 * - While AuthContext is loading, returns false (no admin-UI flicker).
 * - When loading finishes and user is non-admin, redirects + returns false.
 * - When loading finishes and user IS admin, returns true.
 */
export default function useRequireAdmin(redirectTo = '/') {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && !user?.isAdmin) {
            navigate(redirectTo, { replace: true });
        }
    }, [authLoading, user, navigate, redirectTo]);

    return !authLoading && !!user?.isAdmin;
}
