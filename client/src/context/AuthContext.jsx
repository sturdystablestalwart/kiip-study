/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { getAnonymousAttempts, clearAnonymousAttempts, hasAnonymousAttempts } from '../utils/anonymousAttempts';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const migrateAnonymousAttempts = useCallback(async () => {
        if (!hasAnonymousAttempts()) return;
        try {
            const attempts = getAnonymousAttempts();
            await api.post('/api/attempts/migrate', { attempts });
            clearAnonymousAttempts();
        } catch (err) {
            console.error('Failed to migrate anonymous attempts:', err);
        }
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await api.get('/api/auth/me');
            setUser(res.data);
            await migrateAnonymousAttempts();
        } catch {
            setUser(null);
        }
    }, [migrateAnonymousAttempts]);

    useEffect(() => {
        refreshUser().finally(() => setLoading(false));
    }, [refreshUser]);

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
