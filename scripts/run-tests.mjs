import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';

// Tests import TypeScript sources without file extensions, so bundle them with
// esbuild first and hand the plain .js output to node's test runner.
const outDir = 'build-tests';
mkdirSync(outDir, { recursive: true });
const entries = readdirSync('tests').filter((f) => f.endsWith('.test.ts')).map((f) => `tests/${f}`);
execFileSync('npx', ['esbuild', ...entries, '--bundle', '--platform=node', '--format=esm', '--log-level=warning', `--outdir=${outDir}`], { stdio: 'inherit' });
const built = readdirSync(outDir).filter((f) => f.endsWith('.js')).map((f) => `${outDir}/${f}`);
execFileSync('node', ['--test', ...built], { stdio: 'inherit' });
