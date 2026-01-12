import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isProd = process.env.NODE_ENV === 'production'

// https://vitejs.dev/config/
export default defineConfig({
  base: isProd ? './' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true // Expose to network so phones can connect
  }
})

