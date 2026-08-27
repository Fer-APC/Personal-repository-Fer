import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Skip — use sensible defaults' }).click();
await page.waitForTimeout(700);

await page.getByRole('button', { name: 'Log a session I did' }).click();
await page.waitForTimeout(400);
console.log('opens as:', await page.locator('h1').first().textContent());

const dateInput = page.getByLabel('Date');
console.log('date field present:', await dateInput.count() === 1);
console.log('default date:', await dateInput.inputValue());

// Move it back to the Monday of this week.
const monday = await page.evaluate(() => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
await dateInput.fill(monday);
await page.waitForTimeout(400);
console.log('set to monday:', monday, '→ header now:', await page.locator('h1').first().textContent());

await page.getByLabel('What was it').fill('Monday chest and back');
await page.waitForTimeout(200);
console.log('title now:', await page.locator('.topbar .sub').textContent());

for (const name of ['Barbell bench press', 'Lat pulldown']) {
  await page.getByRole('button', { name: '+ Add an exercise' }).click();
  await page.waitForTimeout(250);
  await page.getByPlaceholder('Search exercises or muscles').fill(name);
  await page.waitForTimeout(250);
  await page.locator('.modal .list-item').first().getByRole('button', { name: 'add' }).click();
  await page.waitForTimeout(250);
}
const rows = page.locator('.set-row');
for (let i = 0; i < await rows.count(); i++) {
  await rows.nth(i).locator('input[type=number]').nth(0).fill('10');
  await rows.nth(i).locator('input[type=number]').nth(1).fill('60');
  await rows.nth(i).locator('input[type=checkbox]').check();
}
await page.screenshot({ path: 'build-tests/shots/17-backdated-session.png' });
await page.getByRole('button', { name: 'Save and update my week' }).click();
await page.waitForTimeout(800);

const extras = await page.locator('.card').filter({ hasText: 'Sessions outside the plan' }).innerText();
console.log('listed as:', extras.replace(/\n/g, ' | '));
console.log('date persisted after reload:');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const after = await page.locator('.card').filter({ hasText: 'Sessions outside the plan' }).innerText();
console.log('  ', after.replace(/\n/g, ' | '));
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
