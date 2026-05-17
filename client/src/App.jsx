import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';
import { useTranslation } from 'react-i18next';
import GlobalStyles from './theme/GlobalStyles';
import { below } from './theme/breakpoints';
import { ThemeModeProvider, useThemeMode } from './context/ThemeContext';
const Home = React.lazy(() => import('./pages/Home'));
const TestTaker = React.lazy(() => import('./pages/TestTaker'));
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './utils/api';
import ErrorBoundary from './components/ErrorBoundary';
import useFocusOnRouteChange from './hooks/useFocusOnRouteChange';
import LoadingFallback from './components/LoadingFallback';
import Toast from './components/Toast';
import UpdatePrompt from './components/UpdatePrompt';

// Lazy-load routes that aren't needed on initial page load
const CreateTest = React.lazy(() => import('./pages/CreateTest'));
const EndlessMode = React.lazy(() => import('./pages/EndlessMode'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AdminTestEditor = React.lazy(() => import('./pages/AdminTestEditor'));
const AdminFlags = React.lazy(() => import('./pages/AdminFlags'));
const AdminBulkImport = React.lazy(() => import('./pages/AdminBulkImport'));
const AdminDuplicates = React.lazy(() => import('./pages/AdminDuplicates'));
const SharedTest = React.lazy(() => import('./pages/SharedTest'));
const CommandPalette = React.lazy(() => import('./components/CommandPalette'));
const ShortcutsModal = React.lazy(() => import('./components/ShortcutsModal'));
const MagicLinkVerify = React.lazy(() => import('./pages/MagicLinkVerify'));
const AuthModal = React.lazy(() => import('./components/AuthModal'));
const FailedQuestions = React.lazy(() => import('./pages/FailedQuestions'));

import SearchPaletteContext from './context/SearchPaletteContext';

/* ─── Styled components ─── */

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
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[7]}px;
  padding-bottom: ${({ theme }) => theme.layout.space[4]}px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};

  ${below.mobile} {
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.layout.space[2]}px;
  }
`;

const Logo = styled(Link)`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.accent.clay};
  text-decoration: none;
  letter-spacing: -0.5px;
  margin-right: ${({ theme }) => theme.layout.space[3]}px;

  &:hover {
    color: ${({ theme }) => theme.colors.accent.clay};
    opacity: 0.85;
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
`;

const NavLink = styled(Link)`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
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

const NavSpacer = styled.div`
  flex: 1;
`;

/* ─── Admin dropdown ─── */

const AdminDropdownWrapper = styled.div`
  position: relative;
`;

const AdminTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  font-family: inherit;
  color: ${({ $active, theme }) => $active ? theme.colors.accent.indigo : theme.colors.text.muted};
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  border: none;
  background: none;
  cursor: pointer;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.accent.indigo};
    background: ${({ theme }) => theme.colors.selection.bg};
  }

  &::after {
    content: '\\25BE';
    font-size: 10px;
    margin-left: 2px;
  }
`;

const AdminMenu = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.layout.space[1]}px);
  left: 0;
  min-width: 180px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  z-index: ${({ theme }) => theme.zIndex.dropdown};
  padding: ${({ theme }) => theme.layout.space[1]}px 0;
  overflow: hidden;
`;

const AdminMenuItem = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.primary};
  text-decoration: none;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    background: ${({ theme }) => theme.colors.selection.bg};
  }
`;

/* ─── Utility buttons ─── */

const NavUtilities = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
`;

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.focus.ring};
    background: ${({ theme }) => theme.colors.bg.surface};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  svg {
    width: 16px;
    height: 16px;
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
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
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

const AuthSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
`;

const SignInButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  background: ${({ theme }) => theme.colors.accent.indigo};
  color: ${({ theme }) => theme.colors.onAccent};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: 550;
  text-decoration: none;
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover { opacity: 0.85; }
`;

const SignOutButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  font-family: inherit;
  cursor: pointer;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
    border-color: ${({ theme }) => theme.colors.text.faint};
  }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 ${({ theme }) => theme.layout.space[1]}px;
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  background: ${({ theme }) => theme.colors.state.warning};
  color: ${({ theme }) => theme.colors.onAccent};
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  font-weight: 600;
  margin-left: ${({ theme }) => theme.layout.space[1]}px;
`;

/* ─── Sun / Moon icons ─── */

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/* ─── 404 ─── */

const NotFoundWrapper = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
`;

const NotFoundTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text.muted};
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const NotFoundText = styled.p`
  color: ${({ theme }) => theme.colors.text.faint};
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
`;

const NotFoundLink = styled(Link)`
  color: ${({ theme }) => theme.colors.accent.indigo};
  text-decoration: none;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};

  &:hover {
    text-decoration: underline;
  }
`;

function NotFound() {
  const { t } = useTranslation();
  return (
    <NotFoundWrapper>
      <NotFoundTitle>{t('common.notFound')}</NotFoundTitle>
      <NotFoundText>{t('common.notFoundDesc')}</NotFoundText>
      <NotFoundLink to="/">{t('test.goHome')}</NotFoundLink>
    </NotFoundWrapper>
  );
}

/* ─── Constants ─── */

const LANG_CYCLE = ['en', 'ko', 'ru', 'es'];
const LANG_LABELS = { en: 'EN', ko: '한국어', ru: 'РУ', es: 'ES' };

/* ─── Admin Dropdown component ─── */

function AdminDropdown({ flagCount }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname === '/create';
  const menuId = 'admin-dropdown-menu';

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Issue #76 — focus the first item on open so a keyboard user lands
  // inside the menu instead of skipping past it.
  useEffect(() => {
    if (open && menuRef.current) {
      const first = menuRef.current.querySelector('a, [role="menuitem"]');
      if (first) first.focus();
    }
  }, [open]);

  const handleItemClick = (path) => {
    setOpen(false);
    navigate(path);
  };

  // Issue #76 — arrow-key navigation between items.  Roving tabindex
  // pattern: only the currently-focused item is in the tab order; the
  // rest are tabindex=-1 and reachable via ArrowDown/ArrowUp/Home/End.
  const handleMenuKey = (e) => {
    const items = Array.from(menuRef.current?.querySelectorAll('a, [role="menuitem"]') || []);
    if (items.length === 0) return;
    const currentIdx = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[(currentIdx + 1) % items.length];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[(currentIdx - 1 + items.length) % items.length];
      prev?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      // Tab/Shift+Tab leaves the menu — close it on the way out so
      // the open state doesn't linger.
      setOpen(false);
    }
  };

  const handleTriggerKey = (e) => {
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !open) || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <AdminDropdownWrapper ref={ref}>
      <AdminTrigger
        ref={triggerRef}
        onClick={() => setOpen(prev => !prev)}
        onKeyDown={handleTriggerKey}
        $active={isAdminRoute}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        {t('nav.admin', 'Admin')}
        {flagCount > 0 && <Badge>{flagCount}</Badge>}
      </AdminTrigger>
      {open && (
        <AdminMenu
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={t('nav.admin', 'Admin')}
          onKeyDown={handleMenuKey}
        >
          <AdminMenuItem to="/create" role="menuitem" onClick={() => handleItemClick('/create')}>
            {t('nav.create')}
          </AdminMenuItem>
          <AdminMenuItem to="/admin/flags" role="menuitem" onClick={() => handleItemClick('/admin/flags')}>
            {t('nav.flags')}
            {flagCount > 0 && <Badge>{flagCount}</Badge>}
          </AdminMenuItem>
          <AdminMenuItem to="/admin/import" role="menuitem" onClick={() => handleItemClick('/admin/import')}>
            {t('nav.import')}
          </AdminMenuItem>
          <AdminMenuItem to="/admin/duplicates" role="menuitem" onClick={() => handleItemClick('/admin/duplicates')}>
            {t('nav.duplicates')}
          </AdminMenuItem>
        </AdminMenu>
      )}
    </AdminDropdownWrapper>
  );
}

/* ─── Navigation ─── */

export function Navigation({ onSignIn }) {
  const location = useLocation();
  const { user, loading, logout } = useAuth();
  const { isDark, toggleMode } = useThemeMode();
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
    const baseLang = i18n.language.split('-')[0];
    const currentIdx = LANG_CYCLE.indexOf(baseLang);
    const nextIdx = (currentIdx + 1) % LANG_CYCLE.length;
    i18n.changeLanguage(LANG_CYCLE[nextIdx]);
  };

  const themeLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Nav>
      <Logo to="/">KIIP Study</Logo>
      <NavLinks>
        <NavLink
          to="/"
          active={location.pathname === '/' ? 1 : 0}
          aria-current={location.pathname === '/' ? 'page' : undefined}
        >{t('nav.home')}</NavLink>
        {user && (
          <NavLink
            to="/dashboard"
            active={location.pathname === '/dashboard' ? 1 : 0}
            aria-current={location.pathname === '/dashboard' ? 'page' : undefined}
          >{t('nav.dashboard')}</NavLink>
        )}
        {user?.isAdmin && <AdminDropdown flagCount={flagCount} />}
      </NavLinks>
      <NavSpacer />
      <NavUtilities>
        <LangToggle onClick={cycleLang} aria-label="Change language" title="Change language">
          {LANG_LABELS[i18n.resolvedLanguage || i18n.language.split('-')[0]] || LANG_LABELS.en}
        </LangToggle>
        <IconButton onClick={toggleMode} aria-label={themeLabel} title={themeLabel}>
          {isDark ? <MoonIcon /> : <SunIcon />}
        </IconButton>
        <AuthSection>
          {loading ? null : user ? (
            <SignOutButton onClick={logout}>{t('nav.signOut')}</SignOutButton>
          ) : (
            <SignInButton as="button" onClick={onSignIn}>
              {t('nav.signIn')}
            </SignInButton>
          )}
        </AuthSection>
      </NavUtilities>
    </Nav>
  );
}

// Issue #43 — must live INSIDE <Router> so useLocation works.
function RouteFocusManager() {
  useFocusOnRouteChange();
  return null;
}

// Issue #49 — per-route ErrorBoundary keyed on pathname so a
// chunk-load failure on one page doesn't keep the whole SPA in an
// error state after the user navigates away.  The inner boundary
// catches ChunkLoadError before the outer global one does.
function RoutedErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

function AppInner() {
  const { theme } = useThemeMode();
  const [showPalette, setShowPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const openPalette = useCallback(() => setShowPalette(true), []);
  const searchCtx = React.useMemo(() => ({ openPalette }), [openPalette]);

  const handleGlobalKeyDown = useCallback((e) => {
    // Issue #176 — bail when an editable field has focus so we don't
    // hijack the browser's Print shortcut (Ctrl+P) while the user is
    // typing.  contenteditable covers rich-text editors.
    const ae = document.activeElement;
    const inEditable = !!ae && (
      ae.tagName === 'INPUT' ||
      ae.tagName === 'TEXTAREA' ||
      ae.tagName === 'SELECT' ||
      ae.isContentEditable
    );
    if (inEditable) return;

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
        <SearchPaletteContext.Provider value={searchCtx}>
          <Router>
            <RouteFocusManager />
            <ErrorBoundary>
              <AppShell>
                <Navigation onSignIn={() => setShowAuthModal(true)} />
                <Suspense fallback={<LoadingFallback />}>
                  <RoutedErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/create" element={<CreateTest />} />
                    <Route path="/test/:id" element={<TestTaker />} />
                    <Route path="/endless" element={<EndlessMode />} />
                    <Route path="/admin/tests/:id/edit" element={<AdminTestEditor />} />
                    <Route path="/admin/flags" element={<AdminFlags />} />
                    <Route path="/admin/import" element={<AdminBulkImport />} />
                    <Route path="/admin/duplicates" element={<AdminDuplicates />} />
                    <Route path="/shared/:shareId" element={<SharedTest />} />
                    <Route path="/auth/verify" element={<MagicLinkVerify />} />
                    <Route path="/review" element={<FailedQuestions />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </RoutedErrorBoundary>
                </Suspense>
              </AppShell>
              {showPalette && <Suspense fallback={null}><CommandPalette onClose={() => setShowPalette(false)} /></Suspense>}
              {showShortcuts && <Suspense fallback={null}><ShortcutsModal onClose={() => setShowShortcuts(false)} /></Suspense>}
              {showAuthModal && <Suspense fallback={null}><AuthModal onClose={() => setShowAuthModal(false)} /></Suspense>}
            </ErrorBoundary>
          </Router>
        </SearchPaletteContext.Provider>
        <Toast />
        <UpdatePrompt />
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
