import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('build-tests/shots', { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:4177/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Skip — use sensible defaults' }).click();
await page.waitForTimeout(700);

await page.getByRole('button', { name: 'Dictate a change or a session' }).click();
await page.waitForTimeout(400);
console.log('modal:', await page.locator('.modal strong').first().textContent());
console.log('mic offered:', await page.getByRole('button', { name: /Start talking/ }).count() > 0);

// Chromium has no speech engine here, so type what dictation would produce:
// one continuous string with no punctuation.
const dictation = 'on monday i did squats five sets of five at a hundred kilos bench press three sets of eight at sixty kilos my hamstrings are sore more calisthenics';
await page.locator('.modal textarea').fill(dictation);
await page.waitForTimeout(400);

const understood = await page.locator('.modal .list-item span.small').allInnerTexts();
console.log('understood:');
understood.forEach((u) => console.log('   ✓', u));
await page.screenshot({ path: 'build-tests/shots/18-voice-preview.png' });

const saveButton = page.getByRole('button', { name: /^Save \d+ change/ });
console.log('save button:', await saveButton.innerText());
await saveButton.click();
await page.waitForTimeout(600);
const saved = await page.locator('.modal .list-item span.small').allInnerTexts();
console.log('saved:');
saved.forEach((s) => console.log('   •', s));
await page.screenshot({ path: 'build-tests/shots/19-voice-saved.png' });
await page.getByRole('button', { name: 'Done' }).click();
await page.waitForTimeout(600);

const progress = await page.locator('.card').filter({ hasText: 'Where you are' }).innerText();
console.log('week now:', progress.replace(/\n/g, ' | ').slice(0, 130));
console.log('extra session listed:', /Dictated session/.test(progress));

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const after = await page.locator('.card').filter({ hasText: 'Where you are' }).innerText();
console.log('survives reload:', /Dictated session/.test(after));
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
