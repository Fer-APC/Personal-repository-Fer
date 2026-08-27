/**
 * Packages the built app into one self-contained HTML fragment: styles and
 * script inlined, no external requests, no <html>/<head>/<body> wrapper.
 * Suitable for hosts that supply their own document skeleton.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const OUT_DIR = 'dist-single';
const OUT = join(OUT_DIR, 'training-tracker.html');

const assets = readdirSync(join(DIST, 'assets'));
const cssFile = assets.find((f) => f.endsWith('.css'));
const jsFile = assets.find((f) => f.endsWith('.js'));
if (!cssFile || !jsFile) throw new Error('Build output is missing its CSS or JS bundle');

const css = readFileSync(join(DIST, 'assets', cssFile), 'utf8');
const js = readFileSync(join(DIST, 'assets', jsFile), 'utf8')
  .replace(/\/\/# sourceMappingURL=.*$/m, '') // the .map file will not be shipped
  .replace(/<\/script/gi, '<\\/script'); // keep the inline script from closing early

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT,
  `<title>Training Tracker</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`,
);

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
console.log(`wrote ${OUT} — ${kb(readFileSync(OUT).length)} (css ${kb(css.length)}, js ${kb(js.length)})`);
