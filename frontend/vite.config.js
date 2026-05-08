import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Allow docker dev to proxy to `http://backend:5001` while local dev proxies to `http://localhost:5001`.
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:5001'

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['lucide-react'],
            charts: ['recharts'],
            utils: ['axios', 'file-saver', 'docx']
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      cssCodeSplit: true,
      minify: 'esbuild'
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'axios']
    },
    server: {
      hmr: {
        overlay: false
      },
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  }
})
