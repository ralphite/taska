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
  await expect(pic).toBeVisible()
  await expect(pic).not.toHaveAttribute('data-loaded', '')
  const before = await pic.boundingBox(),
    wordsBefore = await under.boundingBox()
  if (!before || !wordsBefore) throw new Error('not drawn')
  expect(Math.round(before.width / before.height)).toBe(2) // its own shape, before it loads
  await expect(holder.locator('.animate-spin').filter({ visible: true })).toHaveCount(1)
  expect(await holder.locator('.animate-pulse').count()).toBe(0)
  release()
  await expect(pic).toHaveAttribute('data-loaded', '')
  await expect(holder.locator('.animate-spin').filter({ visible: true })).toHaveCount(0)
  const after = await pic.boundingBox(),
    wordsAfter = await under.boundingBox()
  expect(after?.width).toBeCloseTo(before.width, 0)
  expect(after?.height).toBeCloseTo(before.height, 0)
  expect(wordsAfter?.y).toBeCloseTo(wordsBefore.y, 0)
})
