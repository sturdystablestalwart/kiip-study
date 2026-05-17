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

  // 3-way cycle: light → dark → system → light. Default state is 'system' so the
  // toggle visits every mode and a user who once flipped to light/dark can return
  // to following OS preference without clearing localStorage (closes #172).
  const toggleMode = useCallback(() => {
    setMode(prev => {
      const next = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  const setModeExplicit = useCallback(newMode => {
    if (newMode !== 'light' && newMode !== 'dark' && newMode !== 'system') return;
    setMode(newMode);
    localStorage.setItem('theme', newMode);
  }, []);

  const value = useMemo(
    () => ({ mode, isDark, toggleMode, setMode: setModeExplicit, theme }),
    [mode, isDark, toggleMode, setModeExplicit, theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
