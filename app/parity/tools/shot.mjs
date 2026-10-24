// Screenshot a page of the parity viewer (or any URL): node tools/shot.mjs <url> <out.png> [width] [height] [dark]
import { chromium } from 'playwright'
const [url, out, w = 1440, h = 900, scheme = 'light'] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: scheme })
await p.goto(url)
await p.waitForTimeout(1500)
await p.screenshot({ path: out, fullPage: true })
await b.close()
