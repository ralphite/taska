// A quick look at a running Taska in a real (headless) browser: the desktop (1440x900) and the phone (393x852), one
// page at a time. Read-only unless --open: then it also opens the first item of the list (which marks it seen).
//   node app/tools/smoke.mjs <base url> <project> [--open] [--shots <dir>]
import { createRequire } from 'node:module';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');
const [base, project] = process.argv.slice(2);
const open = process.argv.includes('--open');
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
let failed = 0;
const browser = await chromium.launch();
for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 393, height: 852 }, true]]) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  const res = await page.goto(`${base}/p/${project}/`, { waitUntil: 'networkidle', timeout: 60000 });
  const text = await page.locator('body').innerText();
  const ok = res.status() === 200 && text.includes('Items') && text.length > 200;
  let opened = '';
  if (open && ok) {
    const row = page.locator('a[href*="/p/' + project + '/"][href*="/"]').filter({ hasText: /\S/ }).nth(3);
    if (await row.count()) { await row.click(); await page.waitForTimeout(1500); opened = page.url(); }
  }
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
  console.log(`${name}: HTTP ${res.status()}, ${Date.now() - t0} ms, ${text.length} chars, list ${ok ? 'shown' : 'MISSING'}` +
    (opened ? `, opened ${opened}` : '') + (errors.length ? `, errors: ${errors.slice(0, 3).join(' | ')}` : ', no errors'));
  if (!ok || errors.length) failed++;
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
