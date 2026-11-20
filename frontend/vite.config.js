import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    dedupe: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/component', '@firebase/util']
  },
  build: {
    // Target modern browsers (Capacitor WebView supports ES2020+)
    target: 'es2020',
    // Increase warning threshold (we'll split manually)
    chunkSizeWarningLimit: 600,
    // Minify with oxc (Vite 8 default, fastest)
    minify: 'oxc',
    rollupOptions: {
      output: {
        // Manual chunk splitting to break up the 1.6MB bundle
        manualChunks(id) {
          // Firebase - largest dependency, split into own chunk
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          // Framer Motion
          if (id.includes('node_modules/framer-motion')) {
            return 'framer-motion';
          }
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack')) {
            return 'query';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});
