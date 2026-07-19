import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Proxy /.netlify/functions/* to local Netlify Dev during `npm run dev`
  server: {
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    },
  },
})
