// The parts of the page the checks look at, found by what you see where the page says it (roles, names, words).
// Where a part has no name of its own, the rewrite's mark and the old version's id are both given, so the same
// check runs on both while the old version is kept (app/tools/e2e.py --against); the old ones go with it.
import type { Locator, Page } from '@playwright/test'

const shown = (l: Locator) => l.filter({ visible: true })

/** The box you write in. */
export const box = (page: Page) => shown(page.getByRole('textbox', { name: 'Input', exact: true })).first()
/** The line over the box: what it writes to, and that line's own buttons. */
export const boxLine = (page: Page) => page.locator('#scope, #composer:not(:has(#scope)) > div:first-child')
/** The box's round button on the right (Send, or the mic while there is nothing to send). */
export const boxMain = (page: Page) => page.locator('#sendBtn, #composer [data-box="main"]').first()
/** The small mic beside your words. */
export const boxAux = (page: Page) => page.locator('#micBtn, #composer [data-box="aux"]').first()

/** A document's text, block by block. */
export const docBlocks = (page: Page) => page.locator('#docBlocks, [data-doc-blocks]').filter({ visible: true }).first()
export const docBlock = (page: Page, words: string) => docBlocks(page).locator('section[data-key]').filter({ hasText: words })
/** The count of comments beside a block (where the page is too narrow for them beside it). */
export const THREAD_COUNTS =
  '[data-act="doc-thread"], [data-doc-blocks] button[data-thread-count], [data-doc-blocks] section button[aria-label$=" comment"], [data-doc-blocks] section button[aria-label$=" comments"]'
export const threadCounts = (page: Page) => shown(page.locator(THREAD_COUNTS))
/** The comments' own column beside a document. */
export const commentRail = (page: Page) => page.locator('aside[aria-label="Comments"]')
/** The buttons by the block under the pointer: speak a comment, and comment. */
export const blockSay = (page: Page) => shown(page.getByRole('button', { name: 'Speak a comment', exact: true }))
export const blockPick = (page: Page) => shown(page.getByRole('button', { name: 'Comment', exact: true }))
/** A choice in a document's form, to tick. */
export const choice = (page: Page, words: string) => shown(docBlocks(page).locator('[role="group"] button[aria-pressed]').filter({ hasText: words })).first()
/** A document's form (its choices), by one of them. */
export const form = (page: Page, words: string) => shown(docBlocks(page).locator('[role="group"]').filter({ hasText: words })).first()
/** The line over the box's Send choices. */
export const sendChoices = (page: Page) => boxLine(page).getByRole('button', { name: 'Send choices' })
/** A document's card on its item's page. */
export const docCard = (page: Page, title: string) => shown(page.getByRole('button').filter({ hasText: title }).filter({ hasText: /\bD\d+\b/ }))
/** The page shows an item and its document in two columns of their own. */
export const duo = (page: Page) => page.locator('[data-duo]')
/** An item's conversation. */
export const talk = (page: Page) => page.locator('#itemTalk, [data-item-talk]')

/** The list's rows (each item's row), shown. */
export const rows = (page: Page) => shown(page.locator('#list article[data-n]'))
export const row = (page: Page, words: string) => rows(page).filter({ hasText: words })
/** One of the views over the list (Active, Needs you, Finished...), by its name. */
export const view = (page: Page, name: string) => page.locator('#list').getByRole('button', { name: new RegExp('^' + name) }).first()
/** The item (or document) open in its pane: its body, and the words of the line above it. */
export const pane = (page: Page) => shown(page.locator('#detailBody, section > header ~ [data-vc-area]')).last()
export const paneHead = (page: Page) => shown(page.locator('#dHead, [data-pane-head]')).last()
/** The item's status, the chip on its page that opens the status menu. */
export const statusChip = (page: Page) => shown(pane(page).locator('[data-act="item-menu"][data-arm="s"], button[title="Status · S"]')).first()
/** A choice in an open menu that sets an item's field (status, priority...). */
export const fieldChoice = (page: Page, f: string, v: string) => shown(page.locator(`[data-f="${f}"][data-v="${v}"][aria-pressed]`))
/** The card shown under the pointer. */
export const tip = (page: Page) => page.locator('#tip')
/** The buttons a row shows under the pointer (the desktop), by the row's number. */
export const rowActs = (page: Page, n: string | null) =>
  shown(page.locator(`#list [data-act="swipe"][data-n="${n}"], #list [data-act="reopen"][data-n="${n}"], #list article[data-n="${n}"] [data-row-acts] button`))
/** The views over the list, as their buttons. */
export const views = (page: Page) =>
  page.locator('#list [data-views] button[data-views], #list [data-views] button[data-tab="archive"], #list [data-views]:not(:has(button[data-views])) button[aria-pressed]')
/** The box's mic (the first one shown, where the box has two). */
export const mic = (page: Page) => shown(page.getByRole('button', { name: 'Record a voice note', exact: true })).first()
/** The recording, while the box records. */
export const recording = (page: Page) => page.getByRole('status', { name: 'Recording', exact: true }).first()
/** One of the project's tabs (Items, Inputs, Archive, Rules), by its name. */
export const tab = (page: Page, name: string) =>
  shown(page.locator(`[data-act="tab"][data-tab="${name.toLowerCase()}"]`).or(page.getByRole('tab', { name: new RegExp('^' + name) }))).first()
/** A voice note's play button: its length is its words. */
export const voiceChip = (page: Page) => shown(page.getByRole('button', { name: /^Play the voice note/ })).first()
/** The files waiting in the box's draft (to look at, or to remove). */
export const draftFiles = (page: Page) =>
  page.locator('#composer').locator('[data-act="unfile"], [data-act="view-draft"], button[aria-label^="Remove "], button[aria-label^="Look at "]')
/** The words of what is at a point of the screen, as its button says them (its name). */
export const buttonAt = (page: Page, at: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'), at)
/** A row's fold arrow (its subitems shown or hidden), by the row's number. */
export const fold = (page: Page, n: number) => page.locator(`#list [data-act="fold"][data-n="${n}"], #list article[data-n="${n}"] button[aria-label$=" subitems"]`)
/** The line under a parent for its subitems the view hides ("1 more in Later"), by the parent's number. */
export const kidsLine = (page: Page, n: number) => page.locator(`#list [data-act="sub-more"][data-n="${n}"], #list [data-kids-of="${n}"]`)
/** A subitem as its parent's page lists it, by its number and title. */
export const subRow = (page: Page, n: number, title: string) =>
  page.locator(`#itemPage [data-act="goto"][data-n="${n}"]`).or(pane(page).getByRole('button').filter({ hasText: title }))
/** A section's head on the item page (Subitems, Documents...), by its name. */
export const section = (page: Page, name: string) => pane(page).locator('h2').filter({ hasText: name })
/** The sidebar's links for making Taska, and its foot (Documents, Settings...). */
export const devLinks = (page: Page) => page.locator('#devLinks, [data-dev-links]')
export const sideFoot = (page: Page) => page.locator('#sideFoot, [data-side-foot]')
/** The strip at the foot of the page that holds the box. */
export const FOOT = '#foot, footer:has(#composer)'
export const foot = (page: Page) => page.locator(FOOT).first()
/** An item's conversation, as a CSS selector (for code run in the page). */
export const TALK = '#itemTalk, [data-item-talk]'

// ---------------------------------------------------------------- a web page document's parts
/** The buttons by the part of a web page under the pointer (or picked): speak a comment, and comment. */
export const partSay = (page: Page) => shown(page.locator('[data-act="page-say"], [data-part-say]'))
export const partPick = (page: Page) => shown(page.locator('[data-act="page-pick"], [data-part-pick]'))
/** The speak button of the part that quotes these words. */
export const partSayFor = (page: Page, quote: string) =>
  shown(page.locator(`[data-act="page-say"][data-quote="${quote}"], [data-part-say][data-quote="${quote}"]`))
/** A part's speak button while it records: Stop. */
export const partStop = (page: Page) => shown(page.locator('[data-act="page-say"].bg-red-600, [data-part-say].bg-red-600'))
/** The outline round a part (its comments under the pointer or open, or it picked), by the part's key. */
export const partRing = (page: Page, key?: string) => page.locator(key == null ? '[data-ring]' : `[data-ring="${key}"]`)
/** The comments of a part, open under it. */
export const threadPop = (page: Page) => page.locator('[data-thread-pop]')
/** The counts of comments on a web page's parts, and those on the parts whose key starts so. */
export const PAGE_COUNTS = '[data-act="doc-thread"], button[data-count]'
export const pageCount = (page: Page, key: string) =>
  shown(page.locator(`[data-act="doc-thread"][data-key^="${key}"], button[data-count^="${key}"]`))
/** Comment mode (the desktop): a click on the page picks a part instead of working it. */
export const commentMode = (page: Page) =>
  page.locator('[data-act="doc-inspect"]').or(page.locator('[data-part="pane"] > header').getByRole('button', { name: /^Comment/ }))
/** Under a part picked on the phone: type instead, or cancel the recording. */
export const typeInstead = (page: Page) => shown(page.locator('[data-act="doc-type"]').or(page.getByRole('button', { name: 'Type instead', exact: true })))
export const sayCancel = (page: Page) => shown(page.locator('[data-act="doc-say-cancel"]').or(page.getByRole('button', { name: 'Cancel', exact: true })))
/** Taska answering a comment slowly: what the page sends with one waits this long first. */
export const slowComments = (page: Page, ms: number) =>
  page.route(/\/api\/(op|commands)\b/, async (route) => {
    const o = route.request().postDataJSON() as { op?: string; commands?: { op?: string }[] } | { op?: string }[] | null
    const ops = Array.isArray(o) ? o : o?.commands || [o]
    if (ops.some((x) => x?.op === 'dc')) await new Promise((r) => setTimeout(r, ms))
    await route.continue()
  })

// ---------------------------------------------------------------- documents: comments and the editor
/** A comment on a document, as its card. */
export const commentCard = (page: Page, words: string) => shown(page.locator('[data-dc]').filter({ hasText: words })).first()
/** A document's Edit (its editor opens). */
export const docEdit = (page: Page) => shown(page.locator('[data-act="doc-edit"]').or(page.getByRole('button', { name: 'Edit', exact: true }))).first()
/** The editor's mic, and the line that says what it does. */
export const docMic = (page: Page) => page.locator('#docMic').or(page.getByRole('button', { name: /^(Speak|Stop \d)/ })).first()
export const docHint = (page: Page) => page.locator('#docHint').or(page.getByText(/^Listening\./)).first()

// ---------------------------------------------------------------- what waits on you
/** The one action on a row that waits on you (answer, approve, accept), and which it is. */
export const needActs = (page: Page) => page.locator('#list [data-act="row-act"], #list [data-need]')
export const needAct = (page: Page, v: string) => page.locator(`#list [data-act="row-act"][data-v="${v}"], #list [data-need="${v}"]`)
export const needKind = (l: Locator) => l.evaluateAll((els) => els.map((e) => e.getAttribute('data-need') ?? e.getAttribute('data-v')))
/** The sheet over the page (the phone's item and menus). */
export const sheetBody = (page: Page) => page.locator('#dlgBody, [role="dialog"]').filter({ visible: true }).first()
/** An item's priority, the chip on its page that opens its short list. */
export const priChip = (page: Page) => shown(pane(page).locator('[data-arm="p"], button[title="Priority · P"]')).first()
/** Taska says it runs other code than this page, as after a deploy: its answers name a newer page. */
export const NEWS = /\/api\/(poll|view|changes)\b/
export const newer = (json: Record<string, unknown>) =>
  'server' in json ? { ...json, server: { ...(json.server as object), page: 'index-newer.js' } } : { ...json, ver: 'index-newer.js' }
/** The box's file picker. */
export const fileInput = (page: Page) => page.locator('#fileInput, #composer input[type="file"]').first()
/** Taska refusing a comment, as it refuses a change that cannot go in. */
export const refuseComments = (page: Page, why: string) =>
  page.route(/\/api\/(op|commands)\b/, async (route) => {
    const o = route.request().postDataJSON() as { op?: string; commands?: { op?: string }[] } | null
    if (o?.commands) {
      if (!o.commands.some((x) => x?.op === 'dc')) return route.continue()
      return route.fulfill({ status: 400, json: { ok: false, results: [why] } })
    }
    if (o?.op !== 'dc') return route.continue()
    await route.fulfill({ json: { ok: false, res: [why] } })
  })
/** The command palette's rows. */
export const paletteRows = (page: Page) => page.locator('#cpList [data-act="cp-run"], [role="dialog"] button[aria-selected]')
/** An item's menu (the button that opens it), and one of its choices by its words. */
export const itemMenu = (page: Page) => shown(page.locator('#itemMenuBtn').or(page.getByRole('button', { name: 'Item actions', exact: true }))).first()
export const menuChoice = (page: Page, words: RegExp) => sheetBody(page).getByRole('button', { name: words })
/** The toast's Undo. */
export const undo = (page: Page) => shown(page.locator('#toast [data-toast]').or(page.getByRole('button', { name: /^Undo/ }))).first()
