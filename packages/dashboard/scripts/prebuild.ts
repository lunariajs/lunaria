import { cpSync, rmSync } from 'node:fs';

// Remove the previous static files from the dist folder
rmSync('dist/routes', { recursive: true, force: true });
rmSync('dist/components', { recursive: true, force: true });
rmSync('dist/layouts', { recursive: true, force: true });
rmSync('dist/styles', { recursive: true, force: true });
// Copy the static files to the dist folder
cpSync('src/routes', 'dist/routes', { recursive: true });
cpSync('src/components', 'dist/components', { recursive: true });
cpSync('src/layouts', 'dist/layouts', { recursive: true });
cpSync('src/styles', 'dist/styles', { recursive: true });
