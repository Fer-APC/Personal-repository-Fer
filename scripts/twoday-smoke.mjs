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

// Switch to two days a week, as in the report.
await page.locator('.tabbar').getByRole('button', { name: 'Setup' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '2 days', exact: true }).click();
await page.waitForTimeout(300);
await page.locator('.tabbar').getByRole('button', { name: 'Week' }).click();
await page.waitForTimeout(400);
if (await page.locator('.banner.info').count()) {
  await page.getByRole('button', { name: 'Rebuild' }).click();
  await page.waitForTimeout(500);
}
console.log('split:', await page.locator('.topbar .sub').textContent());
console.log('planned day cards:', await page.locator('.day-header').count());

// Log two sessions outside the plan, as in the report.
for (const label of ['first', 'second']) {
  await page.getByRole('button', { name: 'Log a session I did' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '+ Add an exercise' }).click();
  await page.waitForTimeout(250);
  await page.getByPlaceholder('Search exercises or muscles').fill('Barbell bench press');
  await page.waitForTimeout(250);
  await page.locator('.modal .list-item').first().getByRole('button', { name: 'add' }).click();
  await page.waitForTimeout(250);
  const rows = page.locator('.set-row');
  for (let i = 0; i < await rows.count(); i++) {
    await rows.nth(i).locator('input[type=number]').nth(0).fill('10');
    await rows.nth(i).locator('input[type=checkbox]').check();
  }
  await page.getByRole('button', { name: 'Save and update my week' }).click();
  await page.waitForTimeout(700);
  console.log(`logged ${label} session`);
}

const card = await page.locator('.card').filter({ hasText: 'Where you are' }).innerText();
const sessions = card.match(/Sessions\n([^\n]+)/);
console.log('sessions counter:', sessions ? sessions[1] : '?');
console.log('says extras are optional:', /already trained your 2 sessions/.test(card));
console.log('optional chip on a day:', await page.getByText('optional extra').count());
await page.screenshot({ path: 'build-tests/shots/20-two-day-week.png' });
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
