// Yadong's requirements on what is there for making Taska (F448, F508; T475, D45): each check is named by the codes of
// his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/sidebar/ src/features/dev/ src/pages/App.tsx server/taska/http/workspace_routes.py server/taska/services/devdash.py
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import { devLinks, sideFoot } from '../ui'

test('r696 r727: the links for making Taska are a section of their own above the sidebar foot, on this computer only', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the sidebar foot is the desktop’s')
  const p = await project(request, LOOP)
  await open(page, p)
  const dev = devLinks(page)
  await expect(dev).toBeVisible()
  await expect(dev.locator('a')).toHaveText(['Storybook', 'Dashboard'])
  await expect(sideFoot(page).getByRole('link', { name: /^(Storybook|Dashboard)$/ })).toHaveCount(0) // not mixed in with Documents and the rest
  const below = await sideFoot(page).boundingBox(),
    box = await dev.boundingBox()
  if (!below || !box) throw new Error('not drawn')
  expect(box.y + box.height).toBeLessThanOrEqual(below.y + 1)
})

test('r696 r727 D71: the dashboard opens on this computer and is never given through a tunnel', async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto('/dev/dashboard')
  await expect(page.getByText('things you did')).toBeVisible()
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByText('By hour')).toBeVisible()
  const through = await request.get(`${baseURL}/dev/api/dashboard`, { headers: { 'X-Forwarded-Host': 'x.example' } })
  expect(through.status()).not.toBe(200)
})

test('r595 r696: what each item cost, from the line ending an agent’s done message, is on the dashboard', async ({
  page,
  request,
}) => {
  const p = await project(request, { agent: 'new task P1 now Make the export faster\n', approve: ['T1'] })
  // "<cost>: 12 min · 34,567 token (cache read 1,234,567) · 21 steps", as agents write it (I447)
  await p.doAs(
    'T1 done Faster now.\n  成本：12 分钟 · 34,567 token（读缓存 1,234,567）· 21 步\n',
  )
  await page.goto('/dev/dashboard?days=0')
  const row = page.locator('tr', { has: page.locator(`a[href="/p/${p.name}/T1"]`) })
  await expect(row).toContainText('Make the export faster')
  await expect(row).toContainText('35k')
})
