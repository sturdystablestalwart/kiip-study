import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';
import tokens from './theme/tokens';
import GlobalStyles from './theme/GlobalStyles';
import Home from './pages/Home';
import CreateTest from './pages/CreateTest';
import TestTaker from './pages/TestTaker';

const AppShell = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.layout.space[8]}px ${({ theme }) => theme.layout.space[5]}px;

  @media (max-width: 600px) {
    padding: ${({ theme }) => theme.layout.space[5]}px ${({ theme }) => theme.layout.space[4]}px;
  }
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[8]}px;
  padding-bottom: ${({ theme }) => theme.layout.space[5]}px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
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

function Navigation() {
  const location = useLocation();

  return (
    <Nav>
      <Logo to="/">KIIP Study</Logo>
      <NavLinks>
        <NavLink to="/" active={location.pathname === '/' ? 1 : 0}>Tests</NavLink>
        <NavLink to="/create" active={location.pathname === '/create' ? 1 : 0}>New Test</NavLink>
      </NavLinks>
    </Nav>
  );
}

function App() {
  return (
    <ThemeProvider theme={tokens}>
      <GlobalStyles />
      <Router>
        <AppShell>
          <Navigation />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateTest />} />
            <Route path="/test/:id" element={<TestTaker />} />
          </Routes>
        </AppShell>
      </Router>
    </ThemeProvider>
  );
}

export default App;
