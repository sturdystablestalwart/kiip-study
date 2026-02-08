import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';
import Home from './pages/Home';
import CreateTest from './pages/CreateTest';
import TestTaker from './pages/TestTaker';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: 'Noto Sans KR', sans-serif;
    background-color: #F9F7F2;
    color: #4A4A4A;
  }
`;

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 20px;
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 1px solid #E0E0E0;

  a {
    text-decoration: none;
    color: #4A4A4A;
    font-weight: 500;
    margin-left: 20px;
    &:hover {
      color: #D4A373;
    }
  }
`;

const Logo = styled(Link)`
  font-size: 1.5rem;
  font-weight: bold;
  color: #8B7E74 !important;
  margin-left: 0 !important;
`;

function App() {
  return (
    <Router>
      <GlobalStyle />
      <Container>
        <Nav>
          <Logo to="/">KIIP Study</Logo>
          <div>
            <Link to="/">Tests</Link>
            <Link to="/create">New Test</Link>
          </div>
        </Nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateTest />} />
          <Route path="/test/:id" element={<TestTaker />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;