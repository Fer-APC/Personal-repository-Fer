import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR || 'build-tests/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const step = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log('shot:', name); };

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
console.log('H1:', await page.locator('h1').first().textContent());
await step('01-onboarding-goals');

// Step 1 -> 2: availability
await page.getByRole('button', { name: 'Next', exact: true }).click();
console.log('H1:', await page.locator('h1').first().textContent());
await page.getByRole('button', { name: 'Mon', exact: true }).click(); // drop Monday
await step('02-onboarding-availability');

// Step 2 -> 3: activities
await page.getByRole('button', { name: 'Next', exact: true }).click();
console.log('H1:', await page.locator('h1').first().textContent());
await page.getByRole('button', { name: '+ add' }).click();
await page.getByLabel('What').nth(0).selectOption('run_intervals');
await page.getByLabel('Day').nth(0).selectOption('1'); // Tuesday
await page.getByLabel('Effort').nth(0).selectOption('3');
await page.getByRole('button', { name: '+ add' }).click();
await page.getByLabel('What').nth(1).selectOption('volleyball');
await page.getByLabel('Day').nth(1).selectOption('3'); // Thursday
await page.getByLabel('Minutes').nth(1).fill('120');
await step('03-onboarding-activities');

await page.getByRole('button', { name: 'Build my week' }).click();
await page.waitForTimeout(500);
console.log('H1:', await page.locator('h1').first().textContent());
const dayCount = await page.locator('.day-header').count();
console.log('days planned:', dayCount);
console.log('split:', await page.locator('.topbar .sub').textContent());
const firstDay = await page.locator('.card').nth(1).innerText();
console.log('--- first day card ---\n' + firstDay.split('\n').slice(0, 14).join('\n'));
await step('04-week');

// Log a session
await page.getByRole('button', { name: /Start session/ }).first().click();
await page.waitForTimeout(400);
console.log('session H1:', await page.locator('h1').first().textContent());
const setRows = await page.locator('.set-row').count();
console.log('set rows:', setRows);
await page.locator('.set-row input[type=number]').nth(0).fill('8');
await page.locator('.set-row input[type=number]').nth(1).fill('60');
await page.locator('.set-row input[type=number]').nth(2).fill('8');
await page.locator('.set-row input[type=checkbox]').first().check();
await page.waitForTimeout(200);
console.log('progress:', await page.locator('.card').first().innerText().then((t) => t.split('\n').slice(0, 4).join(' ')));
await step('05-session');

await page.getByRole('button', { name: 'Done' }).click();
await page.waitForTimeout(300);

// Balance tab
await page.locator('.tabbar').getByRole('button', { name: 'Balance' }).click();
await page.waitForTimeout(300);
console.log('balance H1:', await page.locator('h1').first().textContent());
console.log('balance rows:', await page.locator('.balance-row').count());
await step('06-balance');

// Setup tab
await page.locator('.tabbar').getByRole('button', { name: 'Setup' }).click();
await page.waitForTimeout(300);
console.log('setup H1:', await page.locator('h1').first().textContent());
await step('07-setup');

// Change a goal and confirm the plan is flagged stale
await page.locator('input[type=range]').nth(2).fill('90');
await page.waitForTimeout(200);
await page.locator('.tabbar').getByRole('button', { name: 'Week' }).click();
await page.waitForTimeout(300);
const banner = await page.locator('.banner.info').count();
console.log('stale banner shown:', banner > 0);
if (banner > 0) {
  await page.getByRole('button', { name: 'Rebuild' }).click();
  await page.waitForTimeout(400);
  console.log('after rebuild split:', await page.locator('.topbar .sub').textContent());
}
await step('08-week-after-goal-change');

// Reload: state must survive
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
console.log('after reload H1:', await page.locator('h1').first().textContent());
console.log('after reload days:', await page.locator('.day-header').count());

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
