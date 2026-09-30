import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// three.js alone is ~1 MB minified (~340 kB gzip); one chunk is fine for a single-page demo.
export default defineConfig({ plugins: [react()], build: { chunkSizeWarningLimit: 1600 } });
