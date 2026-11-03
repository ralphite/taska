// B629: the inputs the prototype lists: one set covering every state an input has (typed, spoken, with pictures,
// long; made one item or two, added to an item, an answer, left for an agent, handled by one, moved to another project,
// organizing, could not be organized, organizing undone, being transcribed), and what became of each, in one set of
// words. Pure data: InputItem.tsx draws them.
import { dayOf, organizing, timeOf } from '../../model/inputs'
import { shownStatus } from '../../model/items'
import { codeOf, type ProjectModel } from '../../model/project'
import type { FileRef, Input, Item, ItemType, OrgNote } from '../../model/types'
import { inputCode } from '../../model/words'
import { T, input, item, modelOf } from '../fixtures'

// ---- the inputs, told against the project's time (T): Today, Yesterday, Oct 21, ...
const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const DAY = 24 * 60
const org = (msg: string, f: Partial<OrgNote> = {}): OrgNote => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
const voice = (len: string, f = 'f9'): FileRef => ({ f: `${f}-voice_${len}.webm`, name: `voice_${len}.webm`, mime: 'audio/webm' })
const shot = (f: string, name: string): FileRef => ({ f, name, mime: 'image/png' })

// square, as a thumbnail shows them (a tall picture in a square box shows only its top)
const svg = (body: string) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">${body}</svg>`)
/** a phone's cart page with the keyboard over its coupon box */
const CART = svg(
  '<rect width="120" height="120" fill="#fff"/><rect width="120" height="14" fill="#f4f4f5"/><rect x="8" y="20" width="60" height="6" rx="2" fill="#d4d4d8"/><rect x="8" y="31" width="104" height="18" rx="3" fill="#f4f4f5"/><rect x="8" y="53" width="104" height="10" rx="3" fill="#fde68a"/><rect y="58" width="120" height="62" fill="#d4d4d8"/>' +
    Array.from({ length: 12 }, (_, i) => `<rect x="${5 + (i % 6) * 18.5}" y="${64 + Math.floor(i / 6) * 17}" width="16" height="13" rx="2" fill="#fff"/>`).join('') +
    '<rect x="24" y="99" width="72" height="13" rx="2" fill="#fff"/>',
)
/** a settings page whose switches do not line up */
const SETTINGS = svg(
  '<rect width="120" height="120" fill="#fff"/><rect width="120" height="14" fill="#f4f4f5"/>' +
    [30, 52, 74, 96].map((y, i) => `<rect x="10" y="${y}" width="${46 + (i % 2) * 12}" height="7" rx="2" fill="#d4d4d8"/><rect x="${82 + (i % 3) * 6}" y="${y - 3}" width="22" height="13" rx="6.5" fill="${i % 2 ? '#a1a1aa' : '#2563eb'}"/>`).join(''),
)
const PICTURES: Record<string, string> = { 'f8-cart.png': CART, 'f7-settings.png': SETTINGS, 'f6-settings-2.png': SETTINGS }

const ITEMS: Item[] = [
  item({ n: 38, type: 'bug', title: '导出的文件丢了筛选条件' }),
  item({ n: 41, type: 'bug', pri: 'P1', title: 'Coupon box hidden behind the keyboard' }),
  item({ n: 43, type: 'feature', title: 'Close the keyboard by tapping outside it' }),
  item({ n: 25, type: 'task', status: 'doing', title: '订单页加载太慢' }),
  item({ n: 7, type: 'task', title: 'Which formats should the export offer?' }),
  item({ n: 30, type: 'bug', status: 'done', title: '设置页的开关对不齐' }),
]

const LONG = [
  'Orders page, what I saw this morning:',
  'With about two thousand orders the page stays blank for four or five seconds, then everything shows at once. Scrolling is fine after that.',
  'It would be enough to show the first fifty right away and load the rest while I look at them. The filter and the sort should still apply to all of them, not only the first fifty.',
  'Same on the phone, a bit slower.',
].join('\n\n')

const INPUTS: Input[] = [
  input({ id: 'r75', t: at(1), text: '', files: [voice('0-18')], trWait: true }),
  input({ id: 'r74', t: at(3), text: '订单页的导出按钮在手机上点不到，被底部栏挡住了。' }),
  input({ id: 'r73', t: at(25), acked: true, touched: [38], files: [voice('0-28', 'f5')], text: '我在订单页设了筛选再导出，导出来的 CSV 里还是全部订单，筛选条件没有带过去。应该只导出我筛出来的那些。', org: org('Created B038') }),
  input({ id: 'r72', t: at(70), acked: true, touched: [41, 43], files: [shot('f8-cart.png', 'cart.png')], text: 'The coupon box hides behind the keyboard on the phone, and there is no way to close the keyboard without leaving the page.', org: org('Created B041 · Created F043') }),
  input({ id: 'r71', t: at(130), acked: true, touched: [25], text: '订单多的时候还是很慢，滚动也卡。', org: org('Added to T025') }),
  input({ id: 'r70', t: at(190), acked: true, kind: 'answer', scope: 7, text: 'CSV and Excel.' }),
  input({ id: 'r69', t: at(250), text: 'Look at why the build takes so long.', org: org('Left for your agent', { keep: true, changed: false }) }),
  input({ id: 'r68', t: at(DAY + 260), acked: true, text: 'Use the staging key from the shared vault for the payment tests.', org: org('Left for your agent', { keep: true, changed: false }) }),
  input({ id: 'r67', t: at(DAY + 330), text: 'The coupon box is in the way again.', org: org('B99 is not in this project', { ok: false, changed: false }) }),
  input({ id: 'r66', t: at(DAY + 400), acked: true, text: 'The app icon looks blurry on the home screen.', moved: { to: 'mobile-app', as: 'r4' } }),
  input({ id: 'r65', t: at(2 * DAY + 120), acked: true, touched: [25], text: LONG, org: org('Added to T025') }),
  input({ id: 'r64', t: at(2 * DAY + 300), acked: true, touched: [30], files: [shot('f7-settings.png', 'settings.png'), shot('f6-settings-2.png', 'settings-2.png')], text: '设置页里这几个开关没对齐，看截图。', org: org('Created B030') }),
  input({ id: 'r63', t: at(3 * DAY + 60), text: 'Put the export button next to the filter.', org: org('Created B044', { undone: true }) }),
  input({ id: 'r62', t: at(3 * DAY + 200), acked: true, touched: [25], files: [voice('0-09', 'f4')], text: '订单页太慢了，看看为什么。', org: org('Created T025') }),
]

const PROJECTS: Record<string, string> = { 'mobile-app': 'Mobile app' }
const MODEL: ProjectModel = modelOf(ITEMS, INPUTS, { organizer: { on: true, model: 'gemini-flash-latest', busy: 'r74' } })

// ---- what became of an input, in one set of words for every version
export interface ItemRef {
  n: number
  code: string
  type: ItemType
  title: string
  status: { s: string; label: string }
}
export type Did = 'Created' | 'Added to'
export type Outcome =
  | { k: 'transcribing' }
  | { k: 'organizing' }
  | { k: 'failed'; why: string }
  | { k: 'undone' }
  | { k: 'filed'; items: { did: Did; item: ItemRef }[] }
  | { k: 'answer'; item: ItemRef }
  | { k: 'agent' }
  | { k: 'handled' }
  | { k: 'moved'; to: string; as: string }

const ref = (m: ProjectModel, n: number): ItemRef | null => {
  const it = m.byN.get(n)
  return it ? { n, code: codeOf(m, n), type: it.type, title: it.title, status: shownStatus(it) } : null
}

export function outcomeOf(r: Input, m: ProjectModel): Outcome {
  if (r.moved) return { k: 'moved', to: PROJECTS[r.moved.to] ?? r.moved.to, as: inputCode(r.moved.as) }
  if (r.trWait) return { k: 'transcribing' }
  if (organizing(r, m.facts.organizer)) return { k: 'organizing' }
  if (r.org?.undone) return { k: 'undone' }
  const scope = r.kind === 'answer' && r.scope ? ref(m, r.scope) : null
  if (scope) return { k: 'answer', item: scope }
  if (r.org && !r.org.ok) return { k: 'failed', why: r.org.msg }
  const items = r.touched.filter((n) => n !== r.scope).flatMap((n) => {
    const it = ref(m, n)
    if (!it) return []
    const did: Did = new RegExp(`Created ${it.code}\\b`).test(r.org?.msg ?? '') ? 'Created' : 'Added to'
    return [{ did, item: it }]
  })
  if (items.length) return { k: 'filed', items }
  return r.acked ? { k: 'handled' } : { k: 'agent' }
}

/** The words for each outcome. */
export const WORD = {
  transcribing: 'Transcribing…',
  organizing: 'Organizing…',
  failed: 'Couldn’t organize',
  undone: 'Organizing undone',
  agent: 'Left for an agent',
  handled: 'Handled by an agent',
  answer: 'Answer to',
  tryAgain: 'Try again',
  organizeAgain: 'Organize again',
  moved: (o: { to: string }) => `Moved to ${o.to}`,
}

// ---- one input as the list draws it
export interface Entry {
  r: Input
  code: string
  /** its day and time: "Today 14:28", "Yesterday 09:10", "Oct 21 11:30" */
  when: string
  out: Outcome
  long: boolean
}

function entries(m: ProjectModel): Entry[] {
  return [...m.inputs]
    .sort((a, b) => Date.parse(b.t) - Date.parse(a.t))
    .map((r) => ({ r, code: inputCode(r.id), when: `${dayOf(r.t, new Date(m.at))} ${timeOf(r.t)}`, out: outcomeOf(r, m), long: r.text.length > 220 || r.text.split('\n').length > 4 }))
}

/** What the list starts with: the inputs, newest first. */
export const ENTRIES: Entry[] = entries(MODEL)
export { PICTURES }
