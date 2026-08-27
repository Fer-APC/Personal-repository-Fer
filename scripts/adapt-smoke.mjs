import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = 'build-tests/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Skip — use sensible defaults' }).click();
await page.waitForTimeout(600);

const dayCards = () => page.locator('.card').filter({ has: page.locator('.day-header') });
const dayExercises = async (n) => dayCards().nth(n).locator('.exercise .name').allInnerTexts();

const before = { d2: await dayExercises(1), d3: await dayExercises(2) };
console.log('BEFORE day2:', before.d2.join(', '));
console.log('progress:', (await page.locator('.card').filter({ hasText: 'Where you are' }).innerText()).replace(/\n/g, ' | '));
await page.screenshot({ path: `${OUT}/12-progress-before.png` });

await page.getByRole('button', { name: 'Log a session I did' }).click();
await page.waitForTimeout(400);
console.log('opened session:', await page.locator('.topbar .sub').textContent());

for (const name of ['Barbell bench press', 'Cable fly', 'Lat pulldown']) {
  await page.getByRole('button', { name: '+ Add an exercise' }).click();
  await page.waitForTimeout(250);
  await page.getByPlaceholder('Search exercises or muscles').fill(name);
  await page.waitForTimeout(250);
  await page.locator('.modal .list-item').first().getByRole('button', { name: 'add' }).click();
  await page.waitForTimeout(250);
}

const rows = page.locator('.set-row');
const n = await rows.count();
for (let i = 0; i < n; i++) {
  await rows.nth(i).locator('input[type=number]').nth(0).fill('10');
  await rows.nth(i).locator('input[type=number]').nth(1).fill('50');
  await rows.nth(i).locator('input[type=checkbox]').check();
}
console.log('sets ticked:', n);
await page.screenshot({ path: `${OUT}/13-adhoc-session.png` });

await page.getByRole('button', { name: 'Save and update my week' }).click();
await page.waitForTimeout(800);

console.log('back on:', await page.locator('h1').first().textContent());
const after = { d2: await dayExercises(1), d3: await dayExercises(2) };
console.log('AFTER  day2:', after.d2.join(', '));
console.log('day2 changed:', JSON.stringify(before.d2) !== JSON.stringify(after.d2));
console.log('day3 changed:', JSON.stringify(before.d3) !== JSON.stringify(after.d3));
console.log('rebuilt badges:', await page.getByText('rebuilt from your logs').count());
console.log('progress after:', (await page.locator('.card').filter({ hasText: 'Where you are' }).innerText()).replace(/\n/g, ' | '));
console.log('extra sessions listed:', await page.getByRole('button', { name: 'open' }).count());
await page.screenshot({ path: `${OUT}/14-progress-after.png` });

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
console.log('after reload, badges:', await page.getByText('rebuilt from your logs').count());
console.log(errors.length ? `CONSOLE ERRORS: ${errors.join(' | ')}` : 'no console errors');
await browser.close();
