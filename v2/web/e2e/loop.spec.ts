// The loop between you and your agents, as the page shows it (D20 sections 3 and 4).
// guards: src/components/List.tsx src/components/Detail.tsx src/components/Talk.tsx src/components/Composer.tsx src/components/Sheets.tsx src/lib/actions.ts src/lib/rows.ts src/lib/views.ts src/lib/outbox.ts src/lib/go.ts server/
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project, treeList } from './seed'

test('what needs you comes first, each with its one action', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  if (await treeList(page)) {
    const views = await page
      .locator('#list [data-views] [data-v]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-v')))
    expect(views).toEqual(['wait', 'all', 'every', 'queued', 'later', 'closed']) // F486: Needs you first (Archive, a tab, sits after All)
  } else {
    const zones = await page
      .locator('#list [data-zone]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-zone')))
    expect(zones.slice(0, 3)).toEqual(['needs', 'queue', 'later'])
  }
  const needs = page.locator('#list [data-act="row-act"]')
  await expect(needs).toHaveCount(3)
  const kinds = await needs.evaluateAll((els) => els.map((e) => e.getAttribute('data-v')).sort())
  expect(kinds).toEqual(['accept', 'answer', 'approve'])
})

test('Accept on a row finishes the work at once', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#list [data-act="row-act"][data-v="accept"]').click()
  await expect.poll(async () => (await p.read('B2')).split('\n')[0]).toMatch(/ done /)
})

test('a question is answered by picking a choice and sending it', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#list [data-act="row-act"][data-v="answer"]').click()
  const where = isDesk(page) ? '#detailBody' : '#dlgBody'
  await page.locator(`${where} [data-act="choice"]`).filter({ hasText: 'JSON' }).click()
  await page.locator(`${where} [data-act="choice-send"]:visible`).first().click()
  await expect.poll(async () => p.read('T1')).toContain('✓ JSON')
})

test('r113: a new input goes to the inbox, and a reply goes to its item', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#text').click()
  await page.keyboard.type('Also export to Excel')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('inbox')).toContain('Also export to Excel')
  await page.locator('#list [data-act="open"]').filter({ hasText: 'Write the user docs' }).click()
  await page.locator('#text').click()
  await page.keyboard.type('Start with the install page')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('T4')).toContain('Start with the install page')
})

test('the item page shows its state, and its priority button changes the priority', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#list [data-act="open"]').filter({ hasText: 'Write the user docs' }).click()
  await expect(page.locator('#detailBody h1')).toHaveText('Write the user docs')
  await page.locator('#detailBody [data-arm="p"]').click() // B358: the button opens its own short list
  await page.locator('#dlgBody [data-f="pri"][data-v="P0"]').click()
  await expect.poll(async () => (await p.read('T4')).split('\n')[0]).toContain(' P0 ')
})
