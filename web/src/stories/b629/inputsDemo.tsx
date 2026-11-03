// B629: what the three versions of the inputs list share: one set of inputs (typed, spoken, with pictures, long; made
// one item or two, added to an item, an answer, left for an agent, handled by one, moved to another project,
// organizing, could not be organized, organizing undone, being transcribed), what became of each in one set of words,
// and the small parts every version draws the same way (an item, what became of it, the files, the buttons, the head).
import { useState, type ReactNode } from 'react'
import { dayOf, organizing, timeOf } from '../../model/inputs'
import { shownStatus } from '../../model/items'
import { codeOf, type ProjectModel } from '../../model/project'
import type { FileRef, Input, Item, ItemType, OrgNote } from '../../model/types'
import { inputCode } from '../../model/words'
import { Hit } from '../../ui/bits'
import { isAudio, isImage, Thumbs } from '../../ui/Files'
import { Icon, StateIcon } from '../../ui/Icon'
import { HIT, LINK_BTN, TYPE_TEXT } from '../../ui/tones'
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
export const MODEL: ProjectModel = modelOf(ITEMS, INPUTS, { organizer: { on: true, model: 'gemini-flash-latest', busy: 'r74' } })

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

/** Not in an item, a project or an agent's hands yet: still with Taska's organizer. */
export const pending = (o: Outcome) => o.k === 'transcribing' || o.k === 'organizing' || o.k === 'failed' || o.k === 'undone'

/** The words for each outcome, the same in every version. */
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

// ---- one input as the versions use it
export interface Entry {
  r: Input
  code: string
  /** its day and time: "Today 14:28", "Yesterday 09:10", "Oct 21 11:30" */
  when: string
  out: Outcome
  long: boolean
}

export function entries(m: ProjectModel, words: readonly string[]): Entry[] {
  return [...m.inputs]
    .sort((a, b) => Date.parse(b.t) - Date.parse(a.t))
    .map((r) => ({ r, code: inputCode(r.id), when: `${dayOf(r.t, new Date(m.at))} ${timeOf(r.t)}`, out: outcomeOf(r, m), long: r.text.length > 220 || r.text.split('\n').length > 4 }))
    .filter((e) => words.every((w) => `${e.code} ${e.r.text}`.toLowerCase().includes(w)))
}

/** The search field's words, and which inputs are opened whole. */
export function useList(q0: string) {
  const [q, setQ] = useState(q0)
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const toggle = (id: string) => setOpened((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))
  return { q, setQ, words, list: entries(MODEL, words), total: MODEL.inputs.length, opened, toggle }
}

// ---- the parts every version draws the same way
const noop = () => {}

/** Its pictures and its voice note, as the page draws them (Thumbs: a thumbnail, the voice chip with its length). */
export function Files({ r, size = 'size-16' }: { r: Input; size?: string }) {
  const files = [...r.files.filter(isImage), ...r.files.filter(isAudio)]
  if (!files.length) return null
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Thumbs files={files} url={(f) => PICTURES[f] ?? '#' + f} size={size} play={() => ({ playing: false, t: null })} tidy={false} on={{ play: noop, words: noop, view: noop }} />
    </div>
  )
}

/** Its words: the searched ones marked; a long one cut to the height `upTo` (a few lines), fading out, with More /
 * Less (a fade, not an ellipsis: an ellipsis after a full stop, or on an empty line between paragraphs, reads wrong). */
export function Words({ e, words, opened, toggle, upTo, cls = '' }: { e: Entry; words: readonly string[]; opened: boolean; toggle(): void; upTo: string; cls?: string }) {
  if (!e.r.text) return null
  return (
    <div className={cls}>
      <p className={`break-words whitespace-pre-line ${e.long && !opened ? `${upTo} overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]` : ''}`}>
        {/* cut short, its paragraphs close up, so the lines shown are words, not the empty line between them */}
        <Hit text={e.long && !opened ? e.r.text.replace(/\n{2,}/g, '\n') : e.r.text} words={words} />
      </p>
      {e.long ? (
        <button onClick={toggle} className="-ml-2 flex h-8 items-center rounded-lg px-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">
          {opened ? 'Less' : 'More'}
        </button>
      ) : null}
    </div>
  )
}

/** An item: its status mark, code and title (the title wraps, it is never cut); `status`: its status in words under
 * it (after it, a Chinese title would wrap to leave one character beside the status). */
export function ItemLink({ it, status = false, cls = 'text-[13px]' }: { it: ItemRef; status?: boolean; cls?: string }) {
  return (
    <button className={`${HIT} -mx-1 flex min-w-0 items-start gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 ${cls}`}>
      <StateIcon {...it.status} cls="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className={`mr-1.5 font-mono text-[0.92em] font-bold ${TYPE_TEXT[it.type]}`}>{it.code}</span>
        <span className="text-zinc-800 dark:text-zinc-200">{it.title}</span>
        {status ? <span className="block text-xs text-zinc-500 dark:text-zinc-400">{it.status.label}</span> : null}
      </span>
    </button>
  )
}

/** Taska is on it: a beating dot, in a box as wide as the icons, so the words after it line up with theirs */
const pulse = (
  <span className="grid size-3.5 shrink-0 place-items-center">
    <span className="size-1.5 animate-pulse rounded-full bg-current" />
  </span>
)
/** A state in words with its mark and colour (blue: Taska is on it; red: it failed; green: done; grey: settled). */
export function State({ o }: { o: Outcome }) {
  const line = (mark: ReactNode, text: string, tone: string) => (
    <span className={`flex min-w-0 items-center gap-1 text-[13px] font-medium ${tone}`}>
      {mark}
      <span className="min-w-0">{text}</span>
    </span>
  )
  const busy = 'text-blue-600 dark:text-blue-400'
  const quiet = 'text-zinc-600 dark:text-zinc-300'
  switch (o.k) {
    case 'transcribing':
      return line(pulse, WORD.transcribing, busy)
    case 'organizing':
      return line(pulse, WORD.organizing, busy)
    case 'failed':
      return line(<Icon n="alert" c="size-3.5" sw="2" />, WORD.failed, 'text-red-600 dark:text-red-400')
    case 'undone':
      return line(<Icon n="undo" c="size-3.5" sw="2" />, WORD.undone, quiet)
    case 'agent':
      return line(<Icon n="bot" c="size-3.5" sw="2" />, WORD.agent, quiet)
    case 'handled':
      return line(<Icon n="check" c="size-3.5" sw="2.25" />, WORD.handled, 'text-emerald-700 dark:text-emerald-400')
    case 'moved':
      return (
        <a href="#" onClick={(ev) => ev.preventDefault()} className="group/moved flex min-w-0 items-center gap-1 text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
          <Icon n="arrow" c="size-3.5" sw="2" />
          <span className="min-w-0 group-hover/moved:underline">
            {WORD.moved(o)} as {o.as}
          </span>
        </a>
      )
    default:
      return null
  }
}

/** What can be done about it now, on one line: why it could not be organized, then Try again; Organize again for one
 * undone. (One moved away is a link to where it is now: its state says it.) */
export function Next({ o }: { o: Outcome }) {
  if (o.k !== 'failed' && o.k !== 'undone') return null
  return (
    <div className="flex flex-wrap items-center gap-x-1">
      {o.k === 'failed' ? <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{o.why}</span> : null}
      <button className={`${LINK_BTN} ${o.k === 'failed' ? '' : '-ml-2'}`}>
        <Icon n="loop" c="size-3.5" sw="2" />
        {o.k === 'failed' ? WORD.tryAgain : WORD.organizeAgain}
      </button>
    </div>
  )
}

/** What became of it, whole: the items with what was done to each, or its state, and what can be done next. */
export function Became({ o }: { o: Outcome }) {
  if (o.k === 'filed' || o.k === 'answer') {
    const rows: { did: string; item: ItemRef }[] = o.k === 'filed' ? o.items : [{ did: WORD.answer, item: o.item }]
    // what was done said once over the items it was done to: "Created" over two items, not twice
    return (
      <div className="flex min-w-0 flex-col items-start">
        {rows.map(({ did, item: it }, i) => (
          <div key={it.n} className="flex min-w-0 flex-col items-start">
            {i && rows[i - 1].did === did ? null : <span className={`text-xs text-zinc-500 dark:text-zinc-400 ${i ? 'mt-1' : ''}`}>{did}</span>}
            <ItemLink it={it} status />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <State o={o} />
      <Next o={o} />
    </div>
  )
}

const BTN = 'flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
/** Its buttons. The phone: the menu (Add more is in it with Edit, Undo organizing, Move, History, Delete). The
 * desktop: Add more and the menu, shown under the pointer only, where the version has room for them without covering
 * anything (`at`: over the row's empty top right corner by default). One moved away has none (it lives in the other
 * project); in its place on the phone an empty space of the same width, so the times line up. */
export function Acts({ e, desk, at = 'absolute top-2 right-2' }: { e: Entry; desk: boolean; at?: string }) {
  const none = e.out.k === 'moved'
  if (desk)
    return none ? null : (
      <span className={`invisible flex items-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 group-focus-within/row:visible group-hover/row:visible dark:bg-zinc-900 dark:ring-zinc-700 ${at}`}>
        <button className={BTN}>
          <Icon n="plus" c="size-3.5" sw="2" />
          Add more
        </button>
        <button className={BTN} aria-label={`More for ${e.code}`} title="More">
          <Icon n="more" c="size-4" />
        </button>
      </span>
    )
  return none ? (
    <span aria-hidden className="-my-2 -mr-2 size-8 shrink-0" />
  ) : (
    <button className={`${BTN} -my-2 -mr-2 w-8 justify-center px-0`} aria-label={`More for ${e.code}`}>
      <Icon n="more" c="size-4" />
    </button>
  )
}

/** The list's head: Inputs, how many (of how many, while searching), the search field. */
export function Head({ desk, shown, total, q, setQ }: { desk: boolean; shown: number; total: number; q: string; setQ(q: string): void }) {
  return (
    <div className={`flex items-center gap-3 ${desk ? 'pb-4' : 'px-4 pt-3 pb-3'}`}>
      <h2 className="shrink-0 text-[17px] font-semibold">
        Inputs <span className="font-normal text-zinc-400 tabular-nums">{q ? `${shown} of ${total}` : total}</span>
      </h2>
      <label className={`ml-auto flex h-9 items-center gap-2 rounded-lg bg-zinc-100 px-2.5 text-sm dark:bg-zinc-800 ${desk ? 'w-64' : 'min-w-0 flex-1'}`}>
        <Icon n="search" c="size-4 shrink-0 text-zinc-400" />
        <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Search inputs" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-400" />
      </label>
    </div>
  )
}

/** Nothing to list: none yet, or none the search finds. */
export const Nothing = ({ q }: { q: string }) => (
  <div className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">{q ? `No inputs match “${q}”` : 'No inputs yet'}</div>
)
