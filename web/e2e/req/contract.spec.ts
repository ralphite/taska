// Behaviours Yadong asked for that held but had no check that fails when they break (T803): each check is named by its
// code (C…) and the item he asked it in, and asserts what he sees.
// guards: src/features/list/ src/features/side/ src/features/sidebar/ src/features/item/ src/features/composer/ src/app/keys.ts src/app/actions.ts src/ui/rowSwipe.ts src/model/boxFoot.ts src/pages/ProjectPageContainer.tsx
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import { box, boxLine, boxMain, foot, pane, row, sheetBody, touchRow, view } from '../ui'

test('C245 B435: clicking a document in Documents opens that document and does not jump to Items or another page', async ({ page, request }) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The launch plan
  First part of the plan.
`,
  })
  await open(page, p, 'docs')
  await expect(page).toHaveURL(/\/docs$/)
  const entry = page.getByText('The launch plan', { exact: true }).filter({ visible: true }).first()
  await expect(entry).toBeVisible()
  await entry.click()
  // the document itself is open, at its own address, and none of the item pages (T…) or the project's list is
  await expect(page).toHaveURL(/\/D0*1(\?|$)/)
  await expect(page.locator('[data-doc-blocks] section').filter({ hasText: 'First part of the plan.' }).filter({ visible: true }).first()).toBeVisible()
  expect(new URL(page.url()).pathname).not.toMatch(/\/T\d+$/)
  // and it stays there: nothing moves it on to Items afterwards
  await page.waitForTimeout(600)
  await expect(page).toHaveURL(/\/D0*1(\?|$)/)
})

test('C250 B572: a Needs you row has no yellow bar at its left edge (it has its coloured button on the right)', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await view(page, 'Needs you').click()
  const it = row(page, 'Pick the export format').first()
  await expect(it).toBeVisible()
  await expect(it.locator('[data-need]').filter({ visible: true })).toHaveCount(1) // the coloured button is there
  const bars = await it.evaluate((art) => {
    const found: string[] = []
    const a = art.getBoundingClientRect()
    for (const el of [art, ...art.querySelectorAll<HTMLElement>('*')]) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo)
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue
        const r = pseudo ? el.getBoundingClientRect() : el.getBoundingClientRect()
        const edge = el === art ? 0 : Math.abs(r.left - a.left)
        // a left border on the row or on what spans it
        if (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== 'none' && edge < 4 && r.height > 20 && cs.borderLeftColor !== 'rgba(0, 0, 0, 0)')
          found.push(`${el.tagName}${pseudo ?? ''} border-left ${cs.borderLeftWidth} ${cs.borderLeftColor}`)
        // a narrow, tall stripe drawn at the left edge (positioned, or a thin box filled with a colour)
        const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
        if (el !== art && filled && edge < 6 && r.width > 0 && r.width <= 6 && r.height >= 16 && r.height > r.width * 2.5)
          found.push(`${el.tagName}${pseudo ?? ''} stripe ${Math.round(r.width)}x${Math.round(r.height)} ${cs.backgroundColor}`)
      }
    }
    return found
  })
  expect(bars, 'the row has a bar at its left edge').toEqual([])
})

test('C260 B758: the Needs you / Active buttons above the list stay put while the list below scrolls', async ({ page, request }) => {
  const many = Array.from({ length: 30 }, (_, i) => `new task P2 now Item number ${i + 1} with a title long enough`).join('\n')
  const p = await project(request, { agent: many + '\n', approve: Array.from({ length: 30 }, (_, i) => `T${i + 1}`) })
  await open(page, p)
  const bar = page.locator('#list [data-views]').filter({ visible: true }).first()
  const scroller = page.locator('#list [data-list-scroll]')
  await expect(bar).toBeVisible()
  const before = await bar.boundingBox()
  await scroller.evaluate((e) => (e.scrollTop = 400))
  await expect.poll(() => scroller.evaluate((e) => e.scrollTop)).toBeGreaterThan(200)
  await page.waitForTimeout(300)
  const after = await bar.boundingBox()
  expect(after).toEqual(before)
  expect(await view(page, 'Needs you').isVisible()).toBe(true)
  expect(await view(page, 'Active').isVisible()).toBe(true)
  // the list itself did move under it
  await scroller.evaluate((e) => (e.scrollTop = e.scrollHeight))
  expect(await bar.boundingBox()).toEqual(before)
})

test('C290 B123: while the caret is in a field a shortcut letter is typed as text and does nothing; the subitem field stays open for the next one', async ({ page, request }) => {
  test.skip(!isDesk(page), 'single-key shortcuts are the desktop’s')
  const p = await project(request, { agent: 'new task P1 now Plan the launch\n', approve: ['T1'] })
  await open(page, p, 'T1')
  const typed = 'pda2cet'
  // Shift-A opens the subitem field; the letters typed in it are text
  await page.mouse.move(700, 500)
  await page.keyboard.press('Shift+A')
  const sub = pane(page).getByRole('textbox', { name: 'Subitem title' })
  await expect(sub).toBeFocused()
  await page.keyboard.type(typed)
  await expect(sub).toHaveValue(typed)
  // and in the box
  await box(page).click()
  await page.keyboard.type(typed)
  await expect(box(page)).toHaveValue(typed)
  await sub.click()
  // nothing acted: no sheet, no toast, the item is as it was (in progress? no: open, P1, same place)
  await expect(sheetBody(page)).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: /\S/ })).toHaveCount(0)
  expect((await p.read('T1')).split('\n')[0]).toMatch(/P1/)
  expect((await p.read('T1')).split('\n')[0]).not.toMatch(/ done /)
  expect(new URL(page.url()).pathname).toMatch(/\/T0*1$/)
  // adding one leaves the field open and empty for the next
  await sub.fill('Book the venue')
  await page.keyboard.press('Enter')
  await expect.poll(() => p.read('items')).toContain('Book the venue')
  await expect(sub).toBeVisible()
  await expect(sub).toHaveValue('')
  await expect(sub).toBeFocused()
  await page.keyboard.type('Print the posters')
  await page.keyboard.press('Enter')
  await expect.poll(() => p.read('items')).toContain('Print the posters')
  await expect(sub).toBeVisible()
})

test('C301 B249: clicking Taska at the top left goes to the index (the projects page)', async ({ page, request }) => {
  test.skip(!isDesk(page), 'the phone’s Taska is in its drawer')
  const p = await project(request, LOOP)
  await open(page, p)
  expect(new URL(page.url()).pathname).toContain(p.url)
  await page.getByRole('link', { name: /Taska/ }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL((u) => u.pathname === '/')
  // the index: the page that lists the projects, with this one in it
  await expect(page.getByText(p.title).filter({ visible: true }).first()).toBeVisible()
  await expect(page.locator('#list article[data-n]')).toHaveCount(0)
})

test('C302 B264: a shortcut that sets P2 on the selected item opens no popover or sheet; a toast says what was done and the priority changes', async ({ page, request }) => {
  test.skip(!isDesk(page), 'shortcuts are the desktop’s')
  const p = await project(request, { agent: 'new task P1 now Plan the launch\n', approve: ['T1'] })
  await open(page, p, 'T1')
  expect((await p.read('T1')).split('\n')[0]).toMatch(/P1/)
  await page.mouse.move(700, 500)
  await page.keyboard.press('p')
  await expect(sheetBody(page)).toHaveCount(0)
  await expect(page.locator('[role="menu"], [role="listbox"], [data-popover]').filter({ visible: true })).toHaveCount(0)
  await page.keyboard.press('2')
  await expect.poll(async () => (await p.read('T1')).split('\n')[0]).toMatch(/P2/)
  await expect(sheetBody(page)).toHaveCount(0)
  const toast = page.getByRole('status').filter({ hasText: /P2/ })
  await expect(toast).toBeVisible()
  await expect(sheetBody(page)).toHaveCount(0)
})

test('C304 B266: when the box is a reply, nothing above it says again that it is one', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  const field = box(page)
  await expect(field).toHaveAttribute('placeholder', 'Reply to T4…')
  // what shows above the box, in the strip that holds it and over it: no line of its own, no word "Reply"
  const line = page.locator('#composer > div:first-child')
  await expect(line).toBeHidden()
  const strip = await foot(page).evaluate((f) => {
    const clone = f.cloneNode(true) as HTMLElement
    clone.querySelectorAll('textarea, input, script, style').forEach((e) => e.remove())
    return clone.innerText
  })
  expect(strip).not.toMatch(/repl/i)
  // nor on the page over the box: the only place that says it is the box's placeholder
  await expect(page.getByText(/Repl(y|ying) (to|in)\b/i).filter({ visible: true })).toHaveCount(0)
})

test('C349 F767: clicking the menu icon in a hover card opens the context menu, and the hover card stays open', async ({ page, request }) => {
  test.skip(!isDesk(page), 'the hover card is the desktop sidebar’s')
  const p = await project(request, LOOP),
    here = await project(request)
  await open(page, here)
  const side = page.locator(`#drawer a[data-slug="${p.name}"]`)
  const card = page.locator('[data-project-card]')
  await side.scrollIntoViewIfNeeded()
  await side.hover()
  await expect(card).toBeVisible({ timeout: 2000 })
  const r = (await side.boundingBox())!
  const c = (await card.boundingBox())!
  await page.mouse.move(c.x + 60, r.y + r.height / 2, { steps: 8 })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Menu', exact: true }).click()
  const menu = sheetBody(page)
  await expect(menu).toBeVisible()
  await expect(menu).toContainText(/Rename|Move|Delete|Archive|Settings|Icon|Open/)
  // the pointer is now in the menu: the card is still there, past the time it takes to go away
  await page.waitForTimeout(800)
  await expect(card).toBeVisible()
  await expect(menu).toBeVisible()
})

test('C357 T57#673: the "Add to" line over the box and the sending status do not stack into two lines', async ({ page, request }) => {
  test.skip(isDesk(page), 'the sending status over the box is the phone’s (the desktop lists what is on its way in the page)')
  // fixme: the status (28 px, "Sending… · words") and the "Add to #1" line (32 px) are two rows, 67 px together; take the
  // fixme out to see it fail on that, and when the two share one line
  test.fixme(true, 'the sending status and the Add to line still stack into two lines (about 67 px, not one line)')
  const p = await project(request, LOOP)
  await p.op({ op: 'input', text: 'Buy milk for the office' })
  await open(page, p, 'inputs')
  // a new input on its way (Taska answers slowly)...
  await page.route(/\/api\/commands\b/, async (r) => {
    await new Promise((ok) => setTimeout(ok, 6000))
    await r.continue()
  })
  await box(page).fill('A brand new thought')
  await boxMain(page).click()
  const sending = foot(page).getByRole('status').filter({ hasText: /^Sending/ })
  await expect(sending).toBeVisible()
  // ...and more being added to another input
  await touchRow(page, page.locator('article').filter({ hasText: 'Buy milk' }).first().locator('xpath=ancestor::div[@data-swipe][1]'))
  await sheetBody(page).getByRole('button', { name: /Add more/ }).click()
  const adding = boxLine(page)
  await expect(adding).toContainText('Add to #1')
  // what sits over the field, from the topmost of the two lines to the box's own: one line's height
  const [s, a] = [await sending.boundingBox(), await adding.boundingBox()]
  if (!s || !a) throw new Error('not drawn')
  const top = Math.min(s.y, a.y)
  const bottom = Math.max(s.y + s.height, a.y + a.height)
  expect(bottom - top, `the status ${JSON.stringify(s)} and the line ${JSON.stringify(a)} take more than one line`).toBeLessThanOrEqual(40)
})

test('C374 T203#1950: on the phone a long press on an item row does nothing more than a tap does (no menu or gesture)', async ({ page, request }) => {
  test.skip(isDesk(page), 'a long press is the phone’s')
  const p = await project(request, LOOP)
  await open(page, p, '?status=every')
  const it = row(page, 'Write the user docs').first()
  await expect(it).toBeVisible()
  const url = page.url()
  await touchRow(page, it) // held still for 650 ms
  await page.waitForTimeout(400)
  await expect(sheetBody(page)).toHaveCount(0)
  await expect(page.locator('[role="menu"]').filter({ visible: true })).toHaveCount(0)
  expect(page.url()).toBe(url)
  // and the row has not moved, as a swipe would move it
  expect(await it.locator('> :first-child').evaluate((e) => (e as HTMLElement).style.transform)).toBe('')
})
