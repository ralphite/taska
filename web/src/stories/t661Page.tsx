// T661, a prototype (nothing here changes Taska): the desktop's New input page redesigned, three ways, beside the page as
// it is today. Every part is the page's own (ComposeHead, Composer, SaidLately with InputRow and BecameLine, Thumbs and
// VoiceLine, the Sidebar with F479's search button, the input's sheets); the rows' looks are InputRow's prototype looks
// (quiet, rail, compact), which the live page does not use. The data is a realistic stretch of a voice-first project:
// Chinese and English words, voice notes, pictures, every kind of outcome, one on its way and one that failed.
import type { ReactNode } from 'react'
import { sideProjects } from '../app/sideProjects'
import { ComposeHead } from '../features/composer/ComposeHead'
import { SaidLately, SaidRow, type SaidEvents } from '../features/composer/SaidLately'
import { DocPaneNav } from '../features/docs/DocPane'
import { asSaidSheet, historySheet, inputMenuSheet } from '../features/inputs/InputSheets'
import { Sidebar } from '../features/sidebar/Sidebar'
import { sideLinks } from '../features/sidebar/sideLinks'
import { draftKey } from '../model/draftTarget'
import { saidOutgoing, saidRows, type SaidInput } from '../model/saidLately'
import type { FileRef, Input, OrgNote, ProjectRow } from '../model/types'
import { Thumbs, VoiceLine, isAudio } from '../ui/Files'
import type { InputLook } from '../ui/InputRow'
import { toneOf } from '../ui/tones'
import { boxAt, out } from './boxFixtures'
import { PICTURE, T, input, item, modelOf } from './fixtures'
import { Frame, PHONE } from './Frames'
import { sideOn } from './sideFixtures'

// ---------------------------------------------------------------- the data: a day and a half of talking to taska

const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const org = (msg: string, f: Partial<OrgNote> = {}): OrgNote => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
const voice = (n: number, len: string, heard = '', tr = ''): FileRef => ({ f: `f${n}-voice_${len}.webm`, name: `voice_${len}.webm`, mime: 'audio/webm', heard, tr })
const SHOT: FileRef = { f: 'f90-orders.png', name: 'orders.png', mime: 'image/png' }
const SHOT2: FileRef = { f: 'f91-session.png', name: 'session.png', mime: 'image/png' }

const ITEMS = [
  item({ n: 479, status: 'doing', title: '搜索默认语音输入进行语义匹配' }),
  item({ n: 659, status: 'done', title: 'Input item 布局从左右两栏改为上下结构' }),
  item({ n: 642, type: 'task', status: 'doing', title: 'Gemini 并行审查所有 Storybook 故事，按优先级列出设计缺陷' }),
  item({ n: 656, type: 'bug', status: 'done', title: '关联的 session 不去做任务分析' }),
  item({ n: 657, status: 'done', title: '悬浮菜单拆分为 comment 与原地录音 voice 两个按钮' }),
  item({ n: 447, type: 'idea', status: 'open', title: '创建 manager session 监听 Taska 任务并做 task delegation，防止卡住并统计 token/耗时' }),
  item({ n: 612, type: 'bug', status: 'open', title: 'Export button does nothing on the orders page' }),
  item({ n: 588, status: 'review', title: 'The export keeps the filter and the sort you set' }),
]

const LONG_ZH =
  'new input，hover 的时候它有那个 add more 这个 button，我们应该把它拆成两个 button，一个是 comment，一个是 voice。这个有点像文档里面悬浮的时候一个情况。Comment 的话就直接是用 text input，就 input box。然后如果是 voice 的话，直接是就在原地一个 voice button 变成一个 recording 状态，然后就可以 record。我再点击一下就直接把这个语音的这个，然后用 add more 加到后面。'
const MANAGER =
  '这是一个 manager，它下面 manage 好几个 session，每一个 session 它的都是相互不关联的，没有任何关系的。绝对是要并行的。就 dev2 manager 它有明确的 instruction，你可以看一下 Taska 对于这样一个情况的 instruction。'

/** Newest first: today's, yesterday's, and two from the day before. */
export const INPUTS: Input[] = [
  input({ id: 'r1031', t: at(1), text: '', files: [voice(31, '0-12')], trWait: true }),
  input({ id: 'r1030', t: at(2), text: 'The export button does nothing on the orders page, see the screenshot.', files: [SHOT] }),
  input({ id: 'r1029', t: at(4), acked: true, touched: [479], text: '加上，我现在做桌面版本的设计。', files: [voice(29, '0-05')], org: org('Noted on F479') }),
  input({ id: 'r1028', t: at(12), text: '把 T642 的结果按优先级排好，先给我看 P0 的。', files: [voice(28, '0-09')], org: org('Some commands failed: err: 503 Service Unavailable', { ok: false, changed: false }) }),
  input({
    id: 'r1027',
    t: at(40),
    acked: true,
    touched: [659],
    text: 'Input item 现在的设计还是很有问题。我们现在分成两栏，像右边的这个状态，放在右边我觉得不合适，应该放在下面。不是左右，而是上下。',
    files: [voice(27, '0-28', 'Input item 现在的设计呃还是很有问题。我们现在分成两栏，就是像右边的这个状态，我们现在放在右边我觉得不合适，应该放在下面。不是左右，而是上下。', 'Input item 现在的设计还是很有问题。我们现在分成两栏，像右边的这个状态，放在右边我觉得不合适，应该放在下面。不是左右，而是上下。')],
    org: org('Created F659'),
  }),
  input({ id: 'r1026', t: at(55), acked: true, touched: [657], text: LONG_ZH, files: [voice(26, '1-00')], org: org('Created F657') }),
  input({ id: 'r1025', t: at(70), kind: 'cancelled', text: 'Maybe the inputs list should say each day once.', files: [voice(25, '0-04')] }),
  input({ id: 'r1024', t: at(903), acked: true, kind: 'answer', scope: 642, text: 'Answered in D115:\n✓ 照建议改 (1. 事项页上半部分默认太矮，子事项被切掉)\n✓ 照建议改 (2. 手机上视图标签行两头的圆形箭头盖住标签)\n✓ 照建议改 (3. 手机输入框写多行时，文字被夹在按钮中间的窄条里)\n✗ 先不改 (4. 设置页的分组标题)' }),
  input({ id: 'r1023', t: at(907), acked: true, touched: [656], text: MANAGER, files: [voice(23, '0-28')], org: org('Noted on B656') }),
  input({
    id: 'r1022',
    t: at(913),
    acked: true,
    touched: [656, 657],
    text: 'http://127.0.0.1:7340/p/dev2/F33\n为什么关联的 session 不去做这个，分析一下看是什么 bug。这个是 P0。',
    files: [SHOT2, voice(22, '0-07'), voice(21, '0-03')],
    org: org('Created B656 · Noted on F657'),
  }),
  input({ id: 'r1021', t: at(916), acked: true, text: '周末买菜：牛奶、鸡蛋、番茄。', moved: { to: 'home', as: 'r88' } }),
  input({ id: 'r1020', t: at(920), acked: true, kind: 'answer', scope: 447, text: '✓ 继续做 manager，在下面说要什么' }),
  input({ id: 'r1019', t: at(925), text: 'Look at why the build takes so long on the release branch.', org: org('Left for your coding agent', { keep: true, changed: false }) }),
  input({ id: 'r1018', t: at(930), text: '把 coupon 那个 bug 关掉。', files: [voice(18, '0-03')], org: org('Created B660', { undone: true }) }),
  input({ id: 'r1017', t: at(60 * 47), acked: true, text: 'Restart the nightly checks after the deploy.' }),
  input({
    id: 'r1016',
    t: at(60 * 48),
    acked: true,
    touched: [588],
    text: 'The export should keep the filter and the sort I set.',
    org: org('Noted on F588'),
    history: [{ text: 'The export should keep the filter I set.', t: at(60 * 48), mode: 'edit' }],
    updated: at(60 * 47),
  }),
]

/** What was just sent and is still on its way (Undo while it may). */
const OUTBOX = [out({ q: 'q9', slug: 'taska', text: '把输入列表上面的搜索框去掉，用侧栏里的搜索。', state: 'sending' })]
const M = modelOf(ITEMS, INPUTS, { slug: 'taska', title: 'taska', organizer: { on: true, model: 'gemini-flash-latest', busy: 'r1030' } })
const title = (slug: string) => ({ home: 'Home' })[slug] ?? slug
const NOW = Date.parse(T)

// ---------------------------------------------------------------- the list, as the page works it out

const noSaid: SaidEvents = { goto() {}, more() {}, append() {}, voice() {}, draft() {}, menu() {}, undoSend() {}, retry() {}, send() {}, outboxRetry() {}, outboxEdit() {}, query() {}, loadMore() {}, moved() {} }
const url = (f: string) => (f.endsWith('.png') ? PICTURE : '#' + f)
const noPlay = () => ({ playing: false, t: null })
const fileOn = { play() {}, words() {}, view() {} }
const thumbs = (size: string) => (f: FileRef[]) => <Thumbs files={f} url={url} size={size} play={noPlay} tidy on={fileOn} />
const voiceLine = (f: FileRef[]) => <VoiceLine files={f} url={url} play={noPlay} tidy bare on={fileOn} />

export interface ListOpts {
  look?: InputLook
  /** the long ones opened */
  opened?: string[]
  /** the one picked (compact) */
  picked?: string | null
  /** pictures smaller, for a compact list */
  small?: boolean
}

/** The rows the page would show, the newest just sent (Undo on it). */
export function saidData(opened: string[] = []): SaidInput[] {
  const said = saidRows(M, { words: [], upTo: 30, opened: new Set(opened), justSent: [{ rid: 'r1029' }], drafts: { [draftKey({ kind: 'amend', mode: 'edit', id: 'r1023' })]: 'my edit' }, mode: null, title })
  return said.rows
}

/** What you said lately, as the page draws it, in a look (none: today's). */
export function List({ look, opened = [], picked = null, small = false }: ListOpts) {
  return (
    <SaidLately
      count={M.inputs.length}
      total={M.inputs.length}
      q=""
      rows={saidData(opened)}
      outgoing={saidOutgoing(OUTBOX, [], 0, [{ q: 'q9' }])}
      more={false}
      words={[]}
      files={thumbs(small ? 'size-10' : 'size-16')}
      look={look}
      head={!look}
      voice={look === 'quiet' || look === 'compact' || look === 'rail' ? voiceLine : undefined}
      picked={picked}
      on={noSaid}
    />
  )
}

// ---------------------------------------------------------------- the page around it

const ROWS: ProjectRow[] = [
  { name: 'taska', title: 'taska', open: 32, needs: 3, pos: 0 },
  { name: 'home', title: 'Home', open: 13, needs: 2, pos: 1 },
  { name: 'shop', title: 'Shop', open: 9, needs: 0, pos: 2 },
]
const SIDE = sideProjects(ROWS, M, 'taska')

/** The desktop's New input page: the sidebar (its search button, F479), the project's name, the box, then `children`. */
export function DeskPage({ children, wide = false }: { children: ReactNode; /** the column wider than the box (List and detail) */ wide?: boolean }) {
  return (
    <div className="flex min-h-full">
      <div className="w-60 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <Sidebar phone={false} projects={SIDE.list} composing links={sideLinks('taska', null)} place="" on={{ ...sideOn, search() {} }} />
      </div>
      <div data-compose className="group/app min-w-0 flex-1 bg-zinc-50 px-8 pt-12 pb-16 dark:bg-zinc-950">
        <div className={wide ? 'mx-auto max-w-[70rem]' : ''}>
          <div className={wide ? 'max-w-[42rem]' : ''}>
            <ComposeHead title="taska" tone={toneOf(SIDE.tones, 'taska')} />
            <div className="[&>div]:bg-transparent [&>div]:p-0">{boxAt({ at: 'new', composePage: true }, true, { placeholder: 'Write to taska…' })}</div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/** The list under the box, the box's width. */
export const Under = ({ children }: { children: ReactNode }) => <section className="mx-auto mt-8 max-w-[42rem]">{children}</section>

/** The desktop at 1440 wide (its height the page's). */
export const Desk = ({ width = 1440, children }: { width?: number; children: ReactNode }) => (
  <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
    <Frame layout="desk" width={width} label="desktop">
      {children}
    </Frame>
  </div>
)

/** The phone (393 wide): the list, the box at the bottom, as the phone's Inputs tab has them. */
export function PhonePage({ children, foot = true }: { children: ReactNode; foot?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      <div className="min-h-0 flex-1 overflow-y-auto pt-3 pb-4">{children}</div>
      {foot ? <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800">{boxAt({ at: '' }, false, { placeholder: 'Write to taska…' })}</div> : null}
    </div>
  )
}

export const Phones = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">{children}</div>
export const Phone = ({ label, children }: { label?: string; children: ReactNode }) => (
  <Frame layout="phone" width={PHONE.width} label={label ?? 'phone'}>
    {children}
  </Frame>
)

// ---------------------------------------------------------------- List and detail: the one picked, whole

/** The input picked in the list, whole: its line opened (words, voice notes, pictures, what it became, its buttons),
 * the voice note's original words, its earlier versions, and everything its menu does, all at once. */
export function Detail({ id, phone = false }: { id: string; phone?: boolean }) {
  const x = saidData([id]).find((s) => s.r.id === id)
  if (!x) return null
  const r = x.r
  const said = r.files.filter((f) => isAudio(f) && (f.heard || f.tr))
  const menu = inputMenuSheet(
    { r: { ...r, files: [] }, send: r.kind === 'cancelled', tidy: false, undo: r.org && r.org.ok && !r.org.undone && r.touched.length ? { tip: '' } : null, move: true, history: false, scope: null, asking: null, deleteTip: '' },
    { send() {}, edit() {}, append() {}, asSaid() {}, undo() {}, move() {}, history() {}, rescope() {}, takeOff() {}, remove() {} },
  )
  const part = (key: string, body: ReactNode) => (
    <div key={key} className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
      {body}
    </div>
  )
  return (
    <div className={phone ? '' : 'overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900'}>
      <div className="px-5 pt-1 pb-1 [&_article]:mx-0 [&_article]:px-0 [&_article]:hover:bg-transparent">
        <SaidRow x={{ ...x, opened: true }} words={[]} files={r.files.length ? thumbs('size-24')(r.files) : null} on={noSaid} />
      </div>
      {said.map((f) => part('said' + f.f, <div className="text-[13px] [&_h3]:text-[13px] [&_h3]:text-zinc-500 [&_p]:text-sm [&_p]:text-zinc-700 [&_section]:mb-3 dark:[&_h3]:text-zinc-400 dark:[&_p]:text-zinc-300">{asSaidSheet(f.heard ?? '', f.tr ?? '').body}</div>))}
      {r.history?.length ? part('history', <div className="[&_p]:text-sm [&_section]:mb-3">{historySheet(r, NOW).body}</div>) : null}
      {part('menu', menu.body)}
    </div>
  )
}

export const Back = () => (
  <div className="flex h-12 items-center px-3">
    <DocPaneNav to="Inputs" onBack={() => {}} />
  </div>
)
