import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'], charts: ['recharts'], dnd: ['@dnd-kit/core', '@dnd-kit/sortable'] },
      },
    },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
