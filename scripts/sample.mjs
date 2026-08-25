import { execFileSync } from 'node:child_process';
execFileSync('npx', ['esbuild', 'scripts/sample-src.ts', '--bundle', '--platform=node', '--format=esm', '--log-level=warning', '--outfile=build-tests/sample.js'], { stdio: 'inherit' });
await import('../build-tests/sample.js');
