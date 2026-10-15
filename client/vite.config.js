import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app talks to the API through this proxy, so cookies just work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Google only allows the exact origin you registered (http://localhost:5173). Never silently move to 5174.
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
