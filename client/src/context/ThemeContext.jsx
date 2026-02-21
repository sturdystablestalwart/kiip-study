/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { lightTheme, darkTheme } from '../theme/tokens';

const ThemeContext = createContext(null);

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'system');

  const mql = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.matchMedia('(prefers-color-scheme: dark)');
  }, []);

  const [systemDark, setSystemDark] = useState(mql ? mql.matches : false);

  useEffect(() => {
    if (!mql) return;
    const handler = (e) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mql]);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);
  const theme = isDark ? darkTheme : lightTheme;

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const next = prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, isDark, cycleMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
