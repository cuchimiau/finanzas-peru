import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En GitHub Pages la app vive en /<repositorio>/ (la acción de publicación define BASE_PATH).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
});
