import { createGlobalStyle } from 'styled-components';

const GlobalStyles = createGlobalStyle`
  /* --- Reset --- */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* --- Base --- */
  html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    scroll-behavior: smooth;
  }

  body {
    font-family: ${({ theme }) => theme.typography.fontSans};
    font-size: ${({ theme }) => theme.typography.scale.body.size}px;
    line-height: ${({ theme }) => theme.typography.scale.body.line}px;
    font-weight: ${({ theme }) => theme.typography.scale.body.weight};
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.bg.canvas};
    min-height: 100vh;
    min-width: 320px;
  }

  #root {
    min-height: 100vh;
  }

  /* --- Typography --- */
  h1, h2, h3, h4, h5, h6 {
    color: ${({ theme }) => theme.colors.text.primary};
  }

  h1 {
    font-size: ${({ theme }) => theme.typography.scale.h1.size}px;
    line-height: ${({ theme }) => theme.typography.scale.h1.line}px;
    font-weight: ${({ theme }) => theme.typography.scale.h1.weight};
  }

  h2 {
    font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
    line-height: ${({ theme }) => theme.typography.scale.h2.line}px;
    font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  }

  h3 {
    font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
    line-height: ${({ theme }) => theme.typography.scale.h3.line}px;
    font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  }

  p {
    max-width: ${({ theme }) => theme.typography.maxLineLengthChars}ch;
  }

  /* --- Links --- */
  a {
    color: ${({ theme }) => theme.colors.accent.indigo};
    text-decoration: none;
    transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

    &:hover {
      color: ${({ theme }) => theme.colors.accent.clay};
    }
  }

  /* --- Buttons --- */
  button {
    font-family: inherit;
    font-size: inherit;
    border: none;
    background: none;
    cursor: pointer;
    color: inherit;
  }

  /* --- Form elements --- */
  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  /* --- Focus visible --- */
  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus.ring};
    outline-offset: 2px;
    border-radius: 4px;
  }

  :focus:not(:focus-visible) {
    outline: none;
  }

  /* --- Selection --- */
  ::selection {
    background-color: ${({ theme }) => theme.colors.selection.bg};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  /* --- Reduced motion --- */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* --- Scrollbar --- */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.bg.canvas};
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border.subtle};
    border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colors.text.faint};
  }
`;

export default GlobalStyles;
