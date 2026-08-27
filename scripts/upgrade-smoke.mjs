import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Skip — use sensible defaults' }).click();
await page.waitForTimeout(700);

// Log a session so there is real history to preserve across the upgrade.
await page.getByRole('button', { name: /Start session/ }).first().click();
await page.waitForTimeout(500);
for (let i = 0; i < 3; i++) {
  const row = page.locator('.set-row').nth(i);
  await row.locator('input[type=number]').nth(0).fill('9');
  await row.locator('input[type=number]').nth(1).fill('45');
  await row.locator('input[type=checkbox]').check();
}
await page.getByRole('button', { name: 'Save and update my week' }).click();
await page.waitForTimeout(700);

// Downgrade the saved state to exactly what the previous release wrote.
await page.evaluate(() => {
  const KEY = 'training-tracker/v1';
  const state = JSON.parse(localStorage.getItem(KEY));
  state.version = 1;
  for (const week of Object.keys(state.plans)) {
    delete state.plans[week].targets;
    state.plans[week].days.forEach((d) => delete d.templateKey);
  }
  localStorage.setItem(KEY, JSON.stringify(state));
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const body = (await page.locator('body').innerText()).trim();
console.log('renders after upgrade:', body ? await page.locator('h1').first().textContent() : '*** BLANK PAGE ***');
console.log('days shown:', await page.locator('.day-header').count());
const progress = await page.locator('.card').filter({ hasText: 'Where you are' }).innerText();
console.log('progress card:', progress.replace(/\n/g, ' | ').slice(0, 120));
console.log('logged sets survived:', /Sets logged \| 3/.test(progress.replace(/\n/g, ' | ')));
console.log('version now:', await page.evaluate(() => JSON.parse(localStorage.getItem('training-tracker/v1')).version));
console.log('targets restored:', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('training-tracker/v1'));
  const p = Object.values(s.plans)[0];
  return p.targets ? Object.keys(p.targets).length + ' muscles' : 'MISSING';
}));
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await page.screenshot({ path: 'build-tests/shots/15-after-upgrade.png' });
await browser.close();
