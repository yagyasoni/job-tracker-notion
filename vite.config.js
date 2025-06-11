import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 'publicDir' specifies the directory containing static assets that should
  // be copied directly to the 'outDir' (dist) without being processed by Rollup/Vite.
  // This is perfect for popup.html, background.js, and icons.
  publicDir: 'public',
  build: {
    outDir: 'dist', // Output to 'dist' folder, which will be our extension
    rollupOptions: {
      input: {
        // Specify the main JavaScript entry point for the React application.
        // This tells Vite to process src/index.jsx and bundle it.
        main: path.resolve(__dirname, 'src/index.jsx'),
      },
      output: {
        // Ensures the bundled JavaScript is named 'main.js' and placed in 'dist/assets'
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  // Base path for assets. Important for relative paths in the extension.
  base: './',
});
