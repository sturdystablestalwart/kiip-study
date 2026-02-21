import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';
import { useTranslation } from 'react-i18next';
import GlobalStyles from './theme/GlobalStyles';
import { below } from './theme/breakpoints';
import { ThemeModeProvider, useThemeMode } from './context/ThemeContext';
import Home from './pages/Home';
import CreateTest from './pages/CreateTest';
import TestTaker from './pages/TestTaker';
import EndlessMode from './pages/EndlessMode';
import AdminTestEditor from './pages/AdminTestEditor';
import AdminFlags from './pages/AdminFlags';
import AdminBulkImport from './pages/AdminBulkImport';
import AdminDuplicates from './pages/AdminDuplicates';
import SharedTest from './pages/SharedTest';
import CommandPalette from './components/CommandPalette';
import ShortcutsModal from './components/ShortcutsModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './utils/api';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));

const AppShell = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.layout.space[8]}px ${({ theme }) => theme.layout.space[5]}px;

  ${below.tablet} {
    padding: ${({ theme }) => theme.layout.space[6]}px ${({ theme }) => theme.layout.space[4]}px;
  }
  ${below.mobile} {
    padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[3]}px;
  }
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[8]}px;
  padding-bottom: ${({ theme }) => theme.layout.space[5]}px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};

  ${below.mobile} {
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.layout.space[3]}px;
  }
`;

const Logo = styled(Link)`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.accent.clay};
  text-decoration: none;
  letter-spacing: -0.5px;

  &:hover {
    color: ${({ theme }) => theme.colors.accent.clay};
    opacity: 0.85;
  }
`;

const NavLinks = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[5]}px;

  ${below.mobile} {
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.layout.space[2]}px;
  }
`;

const NavLink = styled(Link)`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  color: ${({ active, theme }) => active ? theme.colors.accent.indigo : theme.colors.text.muted};
  text-decoration: none;
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.accent.indigo};
    background: ${({ theme }) => theme.colors.selection.bg};
  }
`;

const NavSearchTrigger = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  min-width: 200px;

  &:hover {
    border-color: ${({ theme }) => theme.colors.focus.ring};
    background: ${({ theme }) => theme.colors.bg.surface};
  }

  ${below.tablet} {
    min-width: 140px;
  }
  ${below.mobile} {
    min-width: unset;
    padding: 0 ${({ theme }) => theme.layout.space[3]}px;
    font-size: 0;
    gap: 0;

    &::before {
      content: '\\2315';
      font-size: ${({ theme }) => theme.typography.scale.body.size}px;
    }
  }
`;

const SearchHint = styled.span`
  margin-left: auto;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  opacity: 0.6;

  ${below.mobile} {
    display: none;
  }
`;

const AuthSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const SignInButton = styled.a`
  display: inline-flex;
  align-items: center;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.accent.indigo};
  color: #fff;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: 550;
  text-decoration: none;
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover { opacity: 0.85; }
`;

const UserName = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const SignOutButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  padding: ${({ theme }) => theme.layout.space[2]}px;

  &:hover { color: ${({ theme }) => theme.colors.text.primary}; }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  background: ${({ theme }) => theme.colors.state.warning};
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  margin-left: ${({ theme }) => theme.layout.space[1]}px;
`;

const ThemeToggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 16px;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.focus.ring};
    background: ${({ theme }) => theme.colors.bg.surface};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

const LangToggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  font-weight: 550;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.focus.ring};
    background: ${({ theme }) => theme.colors.bg.surface};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

const LANG_CYCLE = ['en', 'ko', 'ru', 'es'];
const LANG_LABELS = { en: 'EN', ko: '한국어', ru: 'РУ', es: 'ES' };

const THEME_ICONS = { light: '\u25CB', dark: '\u25CF', system: '\u25D0' };
const THEME_LABELS = { light: 'Light mode (click for dark)', dark: 'Dark mode (click for system)', system: 'System mode (click for light)' };

function Navigation({ onSearchClick }) {
  const location = useLocation();
  const { user, loading, logout } = useAuth();
  const { mode, cycleMode } = useThemeMode();
  const { t, i18n } = useTranslation();
  const [flagCount, setFlagCount] = useState(0);

  useEffect(() => {
    if (user?.isAdmin) {
      api.get('/api/admin/flags/count')
        .then(res => setFlagCount(res.data.openCount))
        .catch(() => {});
    }
  }, [user]);

  const cycleLang = () => {
    const currentIdx = LANG_CYCLE.indexOf(i18n.language);
    const nextIdx = (currentIdx + 1) % LANG_CYCLE.length;
    i18n.changeLanguage(LANG_CYCLE[nextIdx]);
  };

  return (
    <Nav>
      <Logo to="/">KIIP Study</Logo>
      <NavSearchTrigger onClick={onSearchClick} aria-label="Search tests">
        {t('nav.search')}
        <SearchHint>Ctrl+P</SearchHint>
      </NavSearchTrigger>
      <NavLinks>
        <NavLink to="/" active={location.pathname === '/' ? 1 : 0}>{t('nav.home')}</NavLink>
        {user && (
          <NavLink to="/dashboard" active={location.pathname === '/dashboard' ? 1 : 0}>{t('nav.dashboard')}</NavLink>
        )}
        {user?.isAdmin && (
          <NavLink to="/create" active={location.pathname === '/create' ? 1 : 0}>{t('nav.create')}</NavLink>
        )}
        {user?.isAdmin && (
          <NavLink to="/admin/flags" active={location.pathname.startsWith('/admin/flags') ? 1 : 0}>
            {t('nav.flags')}{flagCount > 0 && <Badge>{flagCount}</Badge>}
          </NavLink>
        )}
        {user?.isAdmin && (
          <NavLink to="/admin/import" active={location.pathname === '/admin/import' ? 1 : 0}>
            {t('nav.import')}
          </NavLink>
        )}
        {user?.isAdmin && (
          <NavLink to="/admin/duplicates" active={location.pathname === '/admin/duplicates' ? 1 : 0}>
            {t('nav.duplicates')}
          </NavLink>
        )}
      </NavLinks>
      <LangToggle onClick={cycleLang} aria-label="Change language" title="Change language">
        {LANG_LABELS[i18n.language] || LANG_LABELS.en}
      </LangToggle>
      <ThemeToggle onClick={cycleMode} aria-label={THEME_LABELS[mode]} title={THEME_LABELS[mode]}>
        {THEME_ICONS[mode]}
      </ThemeToggle>
      <AuthSection>
        {loading ? null : user ? (
          <>
            <UserName>{user.displayName}</UserName>
            <SignOutButton onClick={logout}>{t('nav.signOut')}</SignOutButton>
          </>
        ) : (
          <SignInButton href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google/start`}>
            {t('nav.signIn')}
          </SignInButton>
        )}
      </AuthSection>
    </Nav>
  );
}

function AppInner() {
  const { theme } = useThemeMode();
  const [showPalette, setShowPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleGlobalKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      setShowPalette(prev => !prev);
      setShowShortcuts(false);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setShowShortcuts(prev => !prev);
      setShowPalette(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <AuthProvider>
        <Router>
          <AppShell>
            <Navigation onSearchClick={() => setShowPalette(true)} />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Suspense fallback={<div>Loading...</div>}><Dashboard /></Suspense>} />
              <Route path="/create" element={<CreateTest />} />
              <Route path="/test/:id" element={<TestTaker />} />
              <Route path="/endless" element={<EndlessMode />} />
              <Route path="/admin/tests/:id/edit" element={<AdminTestEditor />} />
              <Route path="/admin/flags" element={<AdminFlags />} />
              <Route path="/admin/import" element={<AdminBulkImport />} />
              <Route path="/admin/duplicates" element={<AdminDuplicates />} />
              <Route path="/shared/:shareId" element={<SharedTest />} />
            </Routes>
          </AppShell>
          {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
          {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ThemeModeProvider>
      <AppInner />
    </ThemeModeProvider>
  );
}

export default App;
