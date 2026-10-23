// Yadong's requirements on what waits for him (D29, "Agents and talk"; R055; T475, D45): each check is named by the codes
// of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/List.tsx src/components/Detail.tsx src/components/Talk.tsx src/components/Sheets.tsx src/components/ui.tsx src/lib/icons.ts src/lib/rows.ts src/lib/views.ts src/lib/state.ts server/taska/store.py server/taska/views.py
import { expect, test, type Locator, type Page } from '@playwright/test'
import { isDesk, open, project } from '../seed'

test('r68 r326: work an agent is blocked on waits on you: in Needs you, with what it needs and Answer', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P1 now Ship the export\nnew task P2 now Still going\n',
    approve: ['T1', 'T2'],
    then: 'T1 doing\nT2 doing\nT1 block I need the export key\n',
  })
  await open(page, p)
  await page.locator('#list [data-views] [data-v="wait"]').click()
  const rows = page.locator('#list [data-act="open"][data-n]').filter({ visible: true })
  await expect(rows.filter({ hasText: 'Ship the export' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'Still going' })).toHaveCount(0) // only what waits on you
  const row = rows.filter({ hasText: 'Ship the export' }).first()
  await expect(row).toContainText('I need the export key')
  await expect(row.locator('[data-act]').filter({ hasText: 'Answer' }).filter({ visible: true })).toHaveCount(1)
  await open(page, p, 'T1')
  const body = page.locator('#detailBody')
  await expect(
    body
      .getByText(/is blocked and needs you/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible()
  await expect(body.getByText('I need the export key').filter({ visible: true }).first()).toBeVisible()
})

// B535: the item's status as a row and the item page show it: each status icon's label and its tooltip, and the chip
const said = (l: Locator) =>
  l.evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label')} | ${e.querySelector('title')?.textContent}`))
const rowIcons = (page: Page) =>
  page
    .locator('#list [data-act="open"][data-n]')
    .filter({ visible: true })
    .filter({ hasText: 'Ship the export' })
    .locator('svg[role="img"]')
const chip = (page: Page) => page.locator('#detailBody [data-act="item-menu"][data-arm="s"]').filter({ visible: true })

for (const [kind, words] of [
  ['block', 'I need the export key'],
  ['ask', 'Which export key should I use?'],
] as const)
  test(`r326 R055: an item in progress whose agent ${kind === 'block' ? 'is blocked' : 'asks'} reads Needs you, not In progress, on its row and its page; its status stays In progress, and it reads that again once you answer (B535)`, async ({
    page,
    request,
  }) => {
    const p = await project(request, {
      agent: 'new task P1 now Ship the export\n',
      approve: ['T1'],
      then: `T1 doing\nT1 ${kind} ${words}\n`,
    })
    await open(page, p)
    await expect.poll(() => said(rowIcons(page)), 'the row in Active').toEqual(['Needs you | Needs you'])
    await page.locator('#list [data-views] [data-v="wait"]').click()
    await expect.poll(() => said(rowIcons(page)), 'the row in Needs you').toEqual(['Needs you | Needs you'])
    await open(page, p, 'T1')
    await expect(chip(page)).toHaveText(/^Needs you/)
    await expect(chip(page).locator('svg[role="img"]')).toHaveAttribute('aria-label', 'Needs you')
    if (isDesk(page))
      // the desktop's header line has the icon too
      expect(await said(page.locator('#dHead svg[role="img"]').filter({ visible: true }))).toEqual([
        'Needs you | Needs you',
      ])
    // display only: the item is still in progress, and the chip's menu ticks that
    expect((await p.read('T1')).split('\n')[0]).toMatch(/ doing /)
    await chip(page).click()
    const doing = page.locator('[data-act="set-field"][data-f="status"][data-v="doing"]').filter({ visible: true })
    await expect(doing).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-act="set-field"][data-f="status"][aria-pressed="true"]')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(doing).toHaveCount(0)
    // you answer: it reads its status again, on its page and its row
    await page.locator('#text').click()
    await page.keyboard.type('Use the staging key')
    await page.keyboard.press('Shift+Enter')
    await expect.poll(async () => p.read('T1')).toContain('Use the staging key')
    await expect(chip(page)).toHaveText(/^In progress/)
    await open(page, p)
    await expect.poll(() => said(rowIcons(page)), 'the row once answered').toEqual(['In progress | In progress'])
  })

for (const [kind, words] of [
  ['block', 'I need the export key'],
  ['ask', 'Which export key should I use?'],
] as const)
  test(`r781: an item whose agent ${kind === 'block' ? 'is blocked' : 'asks'} says so once: its status reads Needs you, and the line above it has only its code, no ${kind === 'block' ? 'Blocked' : 'Asks you'} (B555)`, async ({
    page,
    request,
  }) => {
    const p = await project(request, {
      agent: 'new task P1 now Ship the export\n',
      approve: ['T1'],
      then: `T1 doing\nT1 ${kind} ${words}\n`,
    })
    await open(page, p, 'T1')
    await expect(chip(page)).toHaveText(/^Needs you/)
    await expect.poll(() => page.locator('#dHead').innerText(), 'the words on the line above').toBe('T1')
  })

test('r802: in a list sorted another way (Filters › Sort) what waits on you is the Needs-you row, its Approve the button on its right, as in Active; no plain row with a word for it (B565)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P1 now Ship the export\nnew task P2 now Still going\n',
    approve: ['T2'],
  })
  for (const at of ['', '?sort=new', '?sort=upd']) {
    await open(page, p, at)
    const row = page.locator('#list article[data-n="1"]')
    await expect(
      row.locator('[data-act="row-act"][data-v="approve"]'),
      `the proposal's Approve ${at || 'in Active'}`,
    ).toBeVisible()
    await expect(page.locator('#list article[data-n="2"] [data-act="row-act"]'), 'nothing waits on T2').toHaveCount(0)
  }
})

test("r802: the card an item's code shows under the pointer says its status in one word, as its row and its page do: Needs you for a blocked item, not In progress and Needs you (B555)", async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'a pointer on the desktop')
  const p = await project(request, {
    agent: 'new task P1 now Ship the export\nnew task P2 now Write the notes\n',
    approve: ['T1', 'T2'],
    then: 'T1 doing\nT1 block I need the export key\nT2 progress Waiting for T1 before the notes.\n',
  })
  await open(page, p, 'T2')
  await page.locator('#itemTalk [data-ref="T1"]').first().hover()
  const tip = page.locator('#tip')
  await expect(tip).toContainText('Needs you')
  await expect(tip).not.toContainText('In progress')
})
