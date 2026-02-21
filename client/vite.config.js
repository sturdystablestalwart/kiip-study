import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/anychart')) return 'anychart';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'vendor';
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'i18n';
        },
      },
    },
  },
})
