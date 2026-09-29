import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/doctor_payment_recorder/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/doctor_payment_recorder/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/doctor_payment_recorder/, '')
      }
    }
  }
})
