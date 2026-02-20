import { execSync } from 'node:child_process';

// Runs the build process whenever changes are found
// in the package through pnpm dev.
execSync('pnpm build', { stdio: 'inherit' });
