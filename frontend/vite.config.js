import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/upload": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/history": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/findings": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/compliance": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/login": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/signup": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/forgot-password": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/reset-password": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/account": { target: "http://127.0.0.1:5000", changeOrigin: true },
    }
  }
})
