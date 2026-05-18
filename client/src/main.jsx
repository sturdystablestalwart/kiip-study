import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/index'
import './index.css'
import App from './App.jsx'
import { installGlobalErrorReporter } from './utils/globalErrorReporter'
import { setupFontPreloadSwap } from './utils/fontPreloader'

// Issue #31 — install window.onerror + unhandledrejection listeners
// BEFORE React mounts so any crash during initial render (including
// chunk-load failures from a stale deploy) still funnels into the
// /api/_log/client-error endpoint pino captures.
installGlobalErrorReporter();

// Issue #481 — promote font preload <link>s to stylesheets in JS so
// the index.html doesn't need an inline onload="..." (CSP-friendly).
setupFontPreloadSwap();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
