import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// Galaxy S24: 1080x2340 at DPR 3 → 360x780 CSS px. The artifact viewer eats
// roughly 120px of that at the top, so usable height is smaller still.
const page = await browser.newPage({
  viewport: { width: 360, height: 660 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
});
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Skip — use sensible defaults' }).click();
await page.waitForTimeout(800);

const audit = async (label) => {
  const r = await page.evaluate(() => {
    const viewport = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const smallTargets = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('button, input, select, textarea, a, summary')) {
      // A control wrapped in a label is tapped through that label.
      const target = el.closest('label') ?? el;
      if (seen.has(target)) continue;
      seen.add(target);
      const box = target.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.height < 44 || box.width < 44) {
        smallTargets.push({
          tag: target.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 24),
          h: Math.round(box.height), w: Math.round(box.width),
        });
      }
    }
    const tiny = [...document.querySelectorAll('*')].filter((el) => {
      if (!el.textContent?.trim() || el.children.length) return false;
      return parseFloat(getComputedStyle(el).fontSize) < 12.5;
    }).length;
    const overflow = document.documentElement.scrollWidth > window.innerWidth;
    return { viewport, docHeight, screens: +(docHeight / viewport).toFixed(1), smallTargets, tiny, overflow };
  });
  console.log(`\n### ${label}`);
  console.log(`  page height: ${r.docHeight}px = ${r.screens} screenfuls of scrolling`);
  console.log(`  horizontal overflow: ${r.overflow}`);
  console.log(`  text under 12.5px: ${r.tiny} elements`);
  console.log(`  tap targets under 44px: ${r.smallTargets.length}`);
  const grouped = {};
  for (const t of r.smallTargets) {
    const key = `${t.tag} ${t.h}x${t.w}`;
    (grouped[key] ||= []).push(t.text);
  }
  for (const [key, texts] of Object.entries(grouped).slice(0, 8)) {
    console.log(`     ${key}: ${[...new Set(texts)].slice(0, 4).join(', ')}`);
  }
};

await audit('Week view');
await page.screenshot({ path: 'build-tests/shots/s24-week.png' });

await page.getByRole('button', { name: /Start session/ }).first().click();
await page.waitForTimeout(600);
await audit('Session logging');
await page.screenshot({ path: 'build-tests/shots/s24-session.png' });
await page.getByRole('button', { name: 'Done' }).click();
await page.waitForTimeout(400);

await page.locator('.tabbar').getByRole('button', { name: 'Setup' }).click();
await page.waitForTimeout(500);
await audit('Setup');
await page.screenshot({ path: 'build-tests/shots/s24-setup.png' });
await browser.close();
