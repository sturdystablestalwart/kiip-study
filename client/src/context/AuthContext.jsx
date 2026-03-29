/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../utils/api';
import { getAnonymousAttempts, clearAnonymousAttempts, hasAnonymousAttempts } from '../utils/anonymousAttempts';

const AuthContext = createContext(null);

async function fetchUser() {
    const res = await api.get('/api/auth/me');
    return res.data;
}

async function migrateAttempts() {
    if (!hasAnonymousAttempts()) return;
    const attempts = getAnonymousAttempts();
    await api.post('/api/attempts/migrate', { attempts });
    clearAnonymousAttempts();
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const initialized = useRef(false);

    const refreshUser = useCallback(async () => {
        try {
            const data = await fetchUser();
            setUser(data);
            await migrateAttempts();
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        fetchUser()
            .then(data => { setUser(data); return migrateAttempts(); })
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const handleExpiry = () => setUser(null);
        window.addEventListener('auth:expired', handleExpiry);
        return () => window.removeEventListener('auth:expired', handleExpiry);
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post('/api/auth/logout');
        } catch {
            // Ignore — clear client state regardless
        }
        setUser(null);
    }, []);

    const value = useMemo(() => ({ user, loading, logout, refreshUser }), [user, loading, logout, refreshUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}
