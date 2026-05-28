import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // Relative base — works for any deploy path (root or /repo-name/ on
    // GitHub Pages). Without this, classic script tags resolve against
    // origin root and 404 under sub-paths.
    base: './',
    plugins: [react()],
    server: {
        port: 56036,
        open: false,
    },
});
