// F479: the phone's search page. The magnifier opens it and its box listens at once (here the browser has no
// microphone: it says so, and you type); what you type searches every project, the one you are in first; a result
// opens its page and Back comes back to the same search; the back arrow at the top leaves it.
// guards: src/pages/SearchPage.tsx src/pages/SearchContainer.tsx src/pages/searchView.ts src/app/search/ src/model/find.ts src/stores/find.ts src/app/page/navigation.ts server/taska/domain/finding.py server/taska/page_api/find.py server/taska/services/meaning.py
import { expect, test, type Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

const searchPage = (page: Page) => page.locator('[data-part="search"]').filter({ visible: true })

test('the phone: say or type what to find, open a result, come back to the same search, leave', async ({ page, request }) => {
  test.skip(isDesk(page), "phone only: the desktop keeps the list's search")
  const p = await project(request, LOOP)
  const other = await project(request, { agent: 'new task P2 now Export the invoices with the filter\n' })
  await open(page, p)
  await page.getByRole('button', { name: 'Search', exact: true }).filter({ visible: true }).first().click()
  await expect(searchPage(page)).toBeVisible()
  // no microphone in this browser: it says so, and the box takes words
  await expect(searchPage(page)).toContainText('Microphone not allowed')
  const field = page.getByRole('textbox', { name: 'What to find' })
  await field.fill('export filter')
  await field.press('Enter')
  // by project: the one you are in first, then the other, each under its name
  const heads = searchPage(page).locator('h2')
  await expect(heads.first()).toContainText(p.title)
  await expect(searchPage(page).locator('h2', { hasText: other.title })).toBeVisible()
  await expect(searchPage(page).getByRole('button', { name: /^Items/ }).first()).toBeVisible()
  await expect(searchPage(page)).toContainText('Export ignores the filter')
  // a result opens its page; its Back comes back to the same search
  await searchPage(page).getByText('Export ignores the filter').first().click()
  await expect(page).toHaveURL(/\/B2$/)
  await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first().click()
  await expect(searchPage(page)).toContainText('Export ignores the filter')
  await expect(field).toHaveValue('export filter')
  // another project's result, and the browser's Back
  await searchPage(page).getByText('Export the invoices with the filter').first().click()
  await expect(page).toHaveURL(new RegExp(other.url + 'T1$'))
  await page.goBack()
  await expect(searchPage(page)).toContainText('Export the invoices with the filter')
  // the back arrow at the top leaves; the next search starts afresh
  await page.getByRole('button', { name: 'Leave search' }).click()
  await expect(searchPage(page)).toHaveCount(0)
  await expect(page.locator('#list article[data-n]').filter({ visible: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Search', exact: true }).filter({ visible: true }).first().click()
  await expect(field).toHaveValue('')
})
