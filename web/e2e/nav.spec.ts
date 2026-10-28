// Going to a project from the sidebar opens the project itself, never a place inside it (B324, B463).
// guards: src/features/sidebar/ src/features/home/ src/features/composer/FootContainer.tsx src/features/composer/SaidLatelyContainer.tsx src/pages/ src/ui/SearchHints.tsx src/app/page/ src/app/project/ src/app/projectLists.ts src/model/route.ts src/sync/
import { expect, test, type Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'
import { foot, pane, sideFoot } from './ui'

const projects = (page: Page) => page.getByRole('button', { name: 'Projects and settings', exact: true }).filter({ visible: true }).first()
/** the New input page's head (the project's name over the box), and what you said under the box */
const composeHead = (page: Page) => page.locator('footer:has(#composer) h1').first()
const composeList = (page: Page) => page.locator('section[aria-label="You said lately"]').first()
const search = (page: Page) => page.locator('input[type="search"]').filter({ visible: true }).first()
/** The project's initial view model. */
const DATA = /\/api\/view\b/

for (const was of ['agents', 'T1', 'rules']) {
  test(`r623 r309: a project opens as itself from the sidebar, even after its ${was} was open (B463)`, async ({
    page,
    request,
  }) => {
    const p = await project(request, LOOP),
      other = await project(request, LOOP)
    await page.goto(p.url + was)
    await page.waitForURL(new RegExp(was + '$'))
    await open(page, other)
    if (!isDesk(page)) await projects(page).click()
    const link = page.locator(`a[href="${p.url}"]`).filter({ visible: true }).first()
    await link.waitFor()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${p.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(new)?$`))
  })
}

test('r309 B324: a project opens as itself from the home table, though it has something waiting on you', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP) // T1 asks: the home row once led into it
  await page.goto('/')
  await page.locator(`a[href="${p.url}"]`).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(new RegExp(`${p.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(new)?$`))
  if (isDesk(page)) await expect(composeHead(page)).toBeVisible()
  else await expect(page.locator('#list article[data-n]').first()).toBeVisible()
  await expect(page.locator('[data-part="pane"] [data-item-top]').filter({ visible: true })).toHaveCount(0)
})

test('r97 r115 r295 r454: the New input page has the box in the middle and all you said below it', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone opens a project on its list; its inputs are a tab')
  const p = await project(request, LOOP)
  for (const text of ['First thought about the export', 'Second thought about the docs']) await p.op({ op: 'input', text })
  await open(page, p)
  const head = composeHead(page),
    box = page.locator('#composer'),
    said = composeList(page)
  await expect(head).toContainText(p.name.replace(/-/g, ' ')) // the project's title
  await expect(said).toContainText('First thought about the export')
  await expect(said).toContainText('Second thought about the docs')
  // the box sits in the middle of its pane, under the project's name, with what you said under it (polled: a slow
  // machine lays the page out late)
  await expect
    .poll(async () => {
      const [h, b, s, pane] = await Promise.all([head, box, said, foot(page)].map((l) => l.boundingBox()))
      if (!h || !b || !s || !pane) return 'not laid out'
      return {
        middle: Math.abs(b.x + b.width / 2 - (pane.x + pane.width / 2)) < 24,
        nameAbove: h.y + h.height <= b.y + 1,
        saidBelow: b.y + b.height <= s.y + 1,
      }
    })
    .toEqual({ middle: true, nameAbove: true, saidBelow: true })
})

test('r454: the list under the New input box is everything you said, more loading as you scroll down', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone opens a project on its list; its inputs are a tab')
  const p = await project(request, LOOP)
  for (let i = 1; i <= 75; i++) await p.op({ op: 'input', text: `Thought number ${i} of many` })
  await open(page, p)
  const said = composeList(page)
  await expect(said).toContainText('Thought number 75 of many') // the newest first
  await expect(said).not.toContainText('Thought number 1 of many') // not all drawn at once
  // scrolling down brings the rest, to the very first
  await expect
    .poll(
      async () => {
        await foot(page).evaluate((el) => el.scrollTo(0, el.scrollHeight))
        return (await said.innerText()).includes('Thought number 1 of many')
      },
      { timeout: 20000 },
    )
    .toBe(true)
})

test("D77 #1 #2, D82 #1-3: an item's address reloaded says Loading in its place until the data comes, then shows the item; an item or a document not in the project says so, and the address keeps it", async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  let hold = true
  await page.route(DATA, async (r) => {
    while (hold) await new Promise((ok) => setTimeout(ok, 100))
    await r.continue()
  })
  await page.goto(p.url + 'T4')
  await expect(page.getByText('Loading T4\u2026', { exact: true }).filter({ visible: true }).first()).toHaveText('Loading T4\u2026')
  hold = false
  await expect(pane(page).locator('h1')).toHaveText('Write the user docs')
  await page.unroute(DATA)
  for (const what of ['T99', 'D99']) {
    await page.goto(p.url + what)
    await expect(page.getByText(`${what} is not in this project`, { exact: true }).filter({ visible: true }).first()).toHaveText(
      `${what} is not in this project`,
    )
    await expect(page).toHaveURL(new RegExp(`/${what}$`))
  }
})

test('D82 #2: the home page says when Taska is out of reach and loads by itself once it answers, without a reload', async ({
  page,
  request,
}) => {
  await project(request) // at least one project to show
  let down = true
  await page.route('**/api/projects', (r) => (down ? r.abort('connectionrefused') : r.continue()))
  await page.goto('/')
  // The home page's list of projects and its connection notice.
  const list = page.locator('main ul').filter({ has: page.locator('li') }).first()
  const row = page.locator(`main a[href^="/p/"]`).filter({ visible: true }).first()
  const offline = page.getByText('Taska is out of reach, retrying\u2026', { exact: true }).filter({ visible: true })
  await expect(list).toContainText('Taska is out of reach, retrying\u2026')
  down = false
  await expect(row).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('out of reach').filter({ visible: true })).toHaveCount(0)
  // the browser kept the list: it stays, and a line over it says Taska is out of reach until it answers again
  down = true
  await page.reload()
  await expect(offline.first()).toHaveText('Taska is out of reach, retrying\u2026')
  await expect(row).toBeVisible()
  down = false
  await expect(offline).toHaveCount(0, { timeout: 15000 })
})

test('D82 #4: a link to a project that never was says only that it is not there; a deleted one offers Restore', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  const none = 'no-such-project-' + p.name
  await page.goto(`/p/${none}/`)
  const restore = page.getByRole('button', { name: 'Restore', exact: true })
  await expect(page.getByText(/^There is no project/).first()).toContainText(`There is no project “${none}”`)
  await expect(restore).toHaveCount(0)
  await request.post('/api/projects/delete', { data: { name: p.name } })
  await page.goto(p.url)
  await expect(page.locator('div').filter({ has: restore }).last().first()).toContainText(p.name)
  await expect(restore.first()).toBeVisible()
  await restore.first().click()
  await expect(page).toHaveURL(new RegExp(`/p/${p.name}/`))
})

test("D82 #5: on the phone an item's page says when Taska is out of reach, as the list does", async ({
  page,
  request,
}) => {
  test.skip(isDesk(page), 'the desktop says it in its bar over both panes')
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  await expect(pane(page).locator('h1')).toHaveText('Write the user docs')
  await page.route('**/api/**', (r) => r.abort())
  for (let i = 0; i < 4; i++) await page.evaluate(() => dispatchEvent(new Event('focus')))
  await expect(page.locator('[data-part="pane"]').getByText(/Offline, retrying/).filter({ visible: true }).first()).toHaveText(/Offline, retrying/, { timeout: 45000 }) // once the poll in flight ends
})

test('D82 #6: Activity that cannot load says so on the desktop too, not Loading for ever', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone said so already')
  const p = await project(request, LOOP)
  await page.route(/\/api\/activity\b/, (r) => r.abort())
  await open(page, p, 'log')
  await expect(page.getByText(/^Couldn't load the change log/).first()).toContainText("Couldn't load the change log")
})

test('D82 #7: a search says what the other projects gave: searching, nothing there, or that they could not be searched', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  let answer: 'hold' | 'fail' | 'go' = 'hold'
  await page.route('**/api/search**', async (r) => {
    while (answer === 'hold') await new Promise((ok) => setTimeout(ok, 100))
    return answer === 'fail' ? r.abort() : r.continue()
  })
  await open(page, p)
  if (!isDesk(page)) await page.getByRole('button', { name: 'Search', exact: true }).filter({ visible: true }).first().click()
  await search(page).fill('zqxj-one')
  await expect(page.getByText('Searching the other projects\u2026', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  answer = 'go'
  await expect(page.getByText('Not in other projects', { exact: true }).filter({ visible: true }).first()).toHaveText('Not in other projects')
  answer = 'fail'
  await search(page).fill('zqxj-two')
  await expect(page.getByText("Couldn't search the other projects", { exact: true }).filter({ visible: true }).first()).toBeVisible()
})

test('D82 #9: switching to another project, its name shows at once (not its address) and the desktop sidebar keeps Documents, Activity and Deleted while its data comes', async ({
  page,
  request,
}) => {
  const a = await project(request, LOOP),
    b = await project(request, LOOP),
    title = b.name.replace(/-/g, ' ')
  await open(page, a)
  await page.route((u) => u.pathname.startsWith(b.url) && /\/api\/view$/.test(u.pathname), async (r) => {
    await new Promise((ok) => setTimeout(ok, 4000))
    await r.continue()
  })
  if (!isDesk(page)) await projects(page).click()
  await page.locator(`#drawer a[href="${b.url}"]`).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(new RegExp(b.url))
  const name = isDesk(page) ? page.locator('nav[aria-label="This project"]').first() : projects(page).first()
  await expect(name, 'before its data comes').toContainText(title, { timeout: 2000 })
  if (isDesk(page)) await expect(sideFoot(page)).toContainText('Documents', { timeout: 2000 })
})
