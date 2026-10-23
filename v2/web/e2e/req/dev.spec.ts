// Yadong's requirements on what is there for making Taska (F448, F508; T475, D45): each check is named by the codes of
// his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Shell.tsx src/pages/Dashboard.tsx src/App.tsx src/lib/state.ts server/taska/web.py server/taska/devdash.py
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

test('r696 r727: the links for making Taska are a section of their own above the sidebar foot, on this computer only', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the sidebar foot is the desktop’s')
  const p = await project(request, LOOP)
  await open(page, p)
  const dev = page.locator('#devLinks')
  await expect(dev).toBeVisible()
  await expect(dev.locator('a')).toHaveText(['Storybook', 'Dashboard'])
  await expect(page.locator('#sideFoot a[data-dev]')).toHaveCount(0) // not mixed in with Documents and the rest
  const below = await page.locator('#sideFoot').boundingBox(),
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
