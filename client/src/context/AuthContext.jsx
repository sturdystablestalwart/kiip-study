/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
        } catch {
            // Ignore — clear client state regardless
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
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
