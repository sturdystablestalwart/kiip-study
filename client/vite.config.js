import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    // Issue #53 — minimum coverage thresholds (v8 provider).  Same
    // intentionally-low starting figures as the server side; ratchet
    // up over time.  Requires `@vitest/coverage-v8` to actually emit
    // a report.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 30,
        statements: 30,
        branches: 30,
        functions: 30,
      },
      exclude: [
        'src/__tests__/**',
        '**/*.test.{js,jsx}',
        'node_modules/**',
        'dist/**',
      ],
    },
  },
  plugins: [
    react(),
    VitePWA({
      // Use 'prompt' so the user-facing UpdatePrompt banner (see
      // src/components/UpdatePrompt.jsx) controls when the new SW takes
      // over. With 'autoUpdate' the SW would activate silently on the next
      // navigation, which leaves long-running test sessions on stale code
      // until the user closes every tab. See issue #122.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'KIIP Study',
        short_name: 'KIIP Study',
        description: 'KIIP Level 2 exam practice platform',
        theme_color: '#F7F2E8',
        background_color: '#F7F2E8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,webp}'],
        globIgnores: ['**/anychart*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
    globalThis.process?.env?.ANALYZE === 'true' && visualizer({
      open: true,
      filename: 'dist/bundle-report.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  server: {
    host: true,
  },
  build: {
    // Issue #207 — pin the JS+CSS target explicitly instead of relying on
    // Vite's 'modules' default, which drifts across versions and is muddier
    // under the rolldown-vite override.  es2022 + chrome91 covers all
    // evergreen browsers from 2021 onward (top-level await, class fields,
    // private methods, optional chaining, nullish coalescing).
    target: 'es2022',
    cssTarget: 'chrome91',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/anychart')) return 'anychart';
          if (id.includes('node_modules/styled-components')) return 'vendor-styles';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'vendor';
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'i18n';
        },
      },
    },
  },
})
