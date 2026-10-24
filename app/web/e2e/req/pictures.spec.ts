// Yadong's requirements on pictures in a text (D29, "Details"; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/ui/markdown/ src/ui/Markdown.tsx src/ui/bits.tsx src/ui/Files.tsx src/features/item/ src/app/page/media.ts src/stores/media.ts server/taska/http/agent_routes.py
import { expect, test } from '@playwright/test'
import { LOOP, open, project } from '../seed'
import { talk } from '../ui'

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

test("D82 #8: a picture attached to a message shows a spinner while it loads and the picture sign when it cannot, never the browser's broken mark", async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  const up = await request.post(`${p.url}api/file?name=shot.png`, {
    headers: { 'Content-Type': 'image/png' },
    data: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  })
  const f = ((await up.json()) as { f: string }).f
  await p.doAs(`T4 say files=${f} The screenshot.\n`)
  let how: 'hold' | 'fail' = 'hold'
  await page.route(`**/f/${f}`, async (r) => {
    while (how === 'hold') await new Promise((ok) => setTimeout(ok, 100))
    await r.abort()
  })
  await open(page, p, 'T4')
  const thumb = talk(page).locator(`[data-act="view"][data-f="${f}"]`).or(talk(page).getByRole('button', { name: 'shot.png', exact: true })).filter({ visible: true }).first()
  await expect(thumb.locator('.animate-spin')).toBeVisible()
  how = 'fail'
  await expect(thumb.locator('img')).toHaveAttribute('data-failed', '')
  await expect(thumb.locator('.animate-spin')).toBeHidden()
  await expect(thumb.locator('svg')).toBeVisible()
})
