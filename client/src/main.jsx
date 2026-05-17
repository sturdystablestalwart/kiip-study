import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/index'
import './index.css'
import App from './App.jsx'
import { installGlobalErrorReporter } from './utils/globalErrorReporter'

// Issue #31 — install window.onerror + unhandledrejection listeners
// BEFORE React mounts so any crash during initial render (including
// chunk-load failures from a stale deploy) still funnels into the
// /api/_log/client-error endpoint pino captures.
installGlobalErrorReporter();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
