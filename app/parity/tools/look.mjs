// For writing scenarios: start the old snapshot on a fresh data copy, open a page, print its accessibility tree.
//   node tools/look.mjs /p/taska/ [phone|desk] [dark]      writes out/look.png
import { chromium } from 'playwright'
import path from 'node:path'
import { PARITY, freePorts, freshData, startServer, versions } from '../lib/servers.mjs'
const [url = '/', kind = 'desk', scheme = 'light'] = process.argv.slice(2)
const [port] = await freePorts(1)
const root = freshData('look')
const srv = await startServer(versions().old, port, root, path.join(PARITY, 'out', 'look-server.log'))
const b = await chromium.launch()
try {
  const phone = kind === 'phone'
  const ctx = await b.newContext({ viewport: phone ? { width: 393, height: 852 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone, colorScheme: scheme, locale: 'en-US', timezoneId: 'America/Los_Angeles' })
  const p = await ctx.newPage()
  await p.goto(srv.base + url)
  await p.waitForTimeout(2500)
  console.log(await p.locator('body').ariaSnapshot())
  await p.screenshot({ path: path.join(PARITY, 'out', 'look.png') })
} finally {
  await b.close()
  await srv.stop()
}
