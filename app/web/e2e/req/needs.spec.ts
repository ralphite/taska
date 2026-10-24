// Yadong's requirements on what waits for him (D29, "Agents and talk"; R055; T475, D45): each check is named by the codes
// of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/list/ src/features/item/ src/app/page/sheets.ts src/ui/ src/model/items.ts src/model/words.ts src/model/project.ts src/pages/DetailContainer.tsx server/taska/domain/ server/taska/page_api/
import { expect, test, type Locator, type Page } from '@playwright/test'
import { isDesk, open, project } from '../seed'
import { box, fieldChoice, pane, paneHead, row, statusChip, talk, tip, view } from '../ui'

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
  await view(page, 'Needs you').click()
  await expect(row(page, 'Ship the export')).toHaveCount(1)
  await expect(row(page, 'Still going')).toHaveCount(0) // only what waits on you
  const it = row(page, 'Ship the export').first()
  await expect(it).toContainText('I need the export key')
  await expect(it.getByRole('button', { name: 'Answer', exact: true }).filter({ visible: true })).toHaveCount(1)
  await open(page, p, 'T1')
  const body = pane(page)
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
const rowIcons = (page: Page) => row(page, 'Ship the export').locator('svg[role="img"]')
const chip = statusChip

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
    await view(page, 'Needs you').click()
    await expect.poll(() => said(rowIcons(page)), 'the row in Needs you').toEqual(['Needs you | Needs you'])
    await open(page, p, 'T1')
    await expect(chip(page)).toHaveText(/^Needs you/)
    await expect(chip(page).locator('svg[role="img"]')).toHaveAttribute('aria-label', 'Needs you')
    if (isDesk(page))
      // the desktop's header line has the icon too
      expect(await said(paneHead(page).locator('svg[role="img"]').filter({ visible: true }))).toEqual([
        'Needs you | Needs you',
      ])
    // display only: the item is still in progress, and the chip's menu ticks that
    expect((await p.read('T1')).split('\n')[0]).toMatch(/ doing /)
    await chip(page).click()
    const doing = fieldChoice(page, 'status', 'doing')
    await expect(doing).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-f="status"][aria-pressed="true"]')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(doing).toHaveCount(0)
    // you answer: it reads its status again, on its page and its row
    await box(page).click()
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
    await expect.poll(() => paneHead(page).innerText(), 'the words on the line above').toBe('T1')
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
    const first = page.locator('#list article[data-n="1"]')
    await expect(first.getByRole('button', { name: 'Approve', exact: true }).filter({ visible: true }), `the proposal's Approve ${at || 'in Active'}`).toBeVisible()
    await expect(
      page.locator('#list article[data-n="2"]').getByRole('button', { name: /^(Approve|Answer|Accept)$/ }),
      'nothing waits on T2',
    ).toHaveCount(0)
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
  await talk(page).locator('[data-ref="T1"]').first().hover()
  await expect(tip(page)).toContainText('Needs you')
  await expect(tip(page)).not.toContainText('In progress')
})

