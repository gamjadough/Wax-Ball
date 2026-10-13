const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/dodoo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const url = process.env.TEST_URL || 'http://127.0.0.1:5174';
async function launch() { return playwright.chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' }); }
function monitor(page, errors) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
}
async function load(page) { const response = await page.goto(url); assert.equal(response.status(), 200); await page.waitForLoadState('networkidle'); }
async function snapshot(page) { return page.evaluate(() => window.WaxArena.getSnapshot()); }
async function clock(page) { await page.clock.install(); await page.clock.pauseAt(new Date()); }
async function start(page, difficulty = 'beginner') {
  await page.locator('#fight-button').click();
  await page.locator('#ai-difficulty').selectOption(difficulty);
  await page.locator('#confirm-battle').click();
  await page.clock.runFor(20);
}
async function smash(page) { await page.evaluate(() => { for (let i = 0; i < 5; i++) document.getElementById('player-ball').click(); }); }
async function fits(page, selector, minimum = 0) {
  const box = await page.locator(selector).boundingBox();
  const size = await page.evaluate(() => ({ width: innerWidth, height: Math.min(innerHeight, window.visualViewport?.height || innerHeight) }));
  assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, `${selector} outside ${size.width}×${size.height}: ${JSON.stringify(box)}`);
  assert.ok(box.width >= minimum && box.height >= minimum, `${selector} must have a ${minimum}px touch area`);
}
async function noOverflow(page) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true, 'page overflow'); }
module.exports = { assert, fs, path, artifacts, url, launch, monitor, load, snapshot, clock, start, smash, fits, noOverflow };
