// For writing scenarios: the old snapshot on a fresh copy, a few steps, then the accessibility tree and a picture.
//   node tools/try.mjs <phone|desk> <path> '<js steps using p>'      e.g. "await p.getByRole('button',{name:'P1'}).click()"
import { chromium } from 'playwright'
import path from 'node:path'
import { PARITY, freePorts, freshData, startServer, versions } from '../lib/servers.mjs'
const [kind, url, code = ''] = process.argv.slice(2)
const [port] = await freePorts(1)
const root = freshData('try')
const srv = await startServer(versions().old, port, root, path.join(PARITY, 'out', 'try-server.log'))
const b = await chromium.launch()
try {
  const phone = kind === 'phone'
  const ctx = await b.newContext({ viewport: phone ? { width: 393, height: 852 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone, locale: 'en-US', timezoneId: 'America/Los_Angeles' })
  const p = await ctx.newPage()
  await p.goto(srv.base + url)
  await p.waitForTimeout(2000)
  await new Function('p', `return (async () => { ${code} })()`)(p)
  await p.waitForTimeout(800)
  console.log(p.url().replace(srv.base, ''))
  console.log(await p.locator('body').ariaSnapshot())
  await p.screenshot({ path: path.join(PARITY, 'out', 'try.png') })
} finally {
  await b.close()
  await srv.stop()
}
