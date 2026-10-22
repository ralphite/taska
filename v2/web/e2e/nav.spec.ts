// Going to a project from the sidebar opens the project itself, never a place inside it (B324, B463).
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

for (const was of ['agents', 'T1', 'rules']) {
  test(`a project opens as itself from the sidebar, even after its ${was} was open (B463)`, async ({
    page,
    request,
  }) => {
    const p = await project(request, LOOP),
      other = await project(request, LOOP)
    await page.goto(p.url + was)
    await page.waitForURL(new RegExp(was + '$'))
    await open(page, other)
    if (!isDesk(page)) await page.locator('#projBtn').click()
    const link = page.locator(`a[href="${p.url}"]`).filter({ visible: true }).first()
    await link.waitFor()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${p.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(new)?$`))
  })
}
