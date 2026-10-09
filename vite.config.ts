/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@products': path.resolve(__dirname, './src/products'),
      '@app': path.resolve(__dirname, './src/app'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
