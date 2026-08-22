import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const MOCK_API = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // The app talks to a same-origin `/api` prefix; the dev server forwards it
    // to the mock API. Keeps CORS out of the picture and means the deployed
    // origin is the only thing that changes between environments.
    proxy: {
      '/api': {
        target: MOCK_API,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
