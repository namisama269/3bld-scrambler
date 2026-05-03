import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // Relative base — works for any deploy path (root or /repo-name/ on
    // GitHub Pages). Without this, classic script tags resolve against
    // origin root and 404 under sub-paths.
    base: './',
    // GitHub Pages on this repo serves from `main /docs`, so we build into
    // `docs/` and commit it. Flip the Pages source in repo Settings once.
    build: { outDir: 'docs' },
    plugins: [react()],
    server: {
        port: 8080,
        open: false,
    },
});
