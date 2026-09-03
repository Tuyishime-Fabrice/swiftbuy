import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    // Recharts is only reached from the two analytics screens, so keeping it in
    // its own chunk stops a shopper paying to download a charting library.
    chunkSizeWarningLimit: 400,
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
  },
})
