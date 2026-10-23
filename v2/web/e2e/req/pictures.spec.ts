// Yadong's requirements on pictures in a text (D29, "Details"; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/lib/markdown.ts src/lib/dims.ts src/components/Talk.tsx src/components/Detail.tsx server/taska/web.py
import { expect, test } from '@playwright/test'
import { LOOP, open, project } from '../seed'

test('r466 r481 r483: a picture keeps its place while it loads, a spinner in the middle and nothing pulsing; nothing moves when it comes', async ({
  page,
  request,
}) => {
  // a real picture, 400 x 200, drawn by the browser
  await page.goto('about:blank')
  const png = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = 400
      c.height = 200
      const g = c.getContext('2d') as CanvasRenderingContext2D
      g.fillStyle = '#3b82f6'
      g.fillRect(0, 0, 400, 200)
      return c.toDataURL('image/png').split(',')[1]
    }),
    'base64',
  )
  const p = await project(request, LOOP)
  const up = await request.post(`${p.url}api/file?name=chart.png`, {
    headers: { 'Content-Type': 'image/png' },
    data: png,
  })
  const f = ((await up.json()) as { f: string }).f
  await p.doAs(`T4 say Here is the chart:\n  ![the chart](${f})\n  The words under the chart.\n`)
  // the picture comes late
  let release = () => {}
  const held = new Promise<void>((r) => (release = r))
  await page.route(`**/f/${f}`, async (route) => {
    await held
    await route.continue()
  })
  await open(page, p, 'T4')
  const pic = page.locator(`img[data-pic][src$="${f}"]`).filter({ visible: true }).first()
  const holder = pic.locator('xpath=..')
  const under = page.getByText('The words under the chart.').filter({ visible: true }).first()
  // the picture is held back, so everything below happens before it comes, however slow the machine is
  await expect(pic).toBeVisible()
  await expect(pic).not.toHaveAttribute('data-loaded', '')
  // its place is kept once Taska has said its size (asked when the project opens; on a slow machine that answer can
  // come seconds later): wait for that, not for a fixed time
  await expect(pic).toHaveAttribute('width', '400', { timeout: 15000 })
  await expect(pic).toHaveAttribute('height', '200')
  await expect
    .poll(async () => {
      const b = await pic.boundingBox()
      return b ? Math.round(b.width / b.height) : 0
    })
    .toBe(2) // its own shape, before it loads
  await expect(holder.locator('.animate-spin').filter({ visible: true })).toHaveCount(1)
  expect(await holder.locator('.animate-pulse').count()).toBe(0)
  // where it is and where the words under it are, measured from the picture (the talk may still scroll as a whole)
  const place = async () => {
    const [b, w] = [await pic.boundingBox(), await under.boundingBox()]
    if (!b || !w) throw new Error('not drawn')
    return { w: Math.round(b.width), h: Math.round(b.height), below: Math.round(w.y - b.y) }
  }
  const before = await place()
  release()
  await expect(pic).toHaveAttribute('data-loaded', '', { timeout: 15000 })
  await expect(holder.locator('.animate-spin').filter({ visible: true })).toHaveCount(0)
  // nothing moved: the picture is the size it held, the words as far below it
  expect(await place()).toEqual(before)
})
