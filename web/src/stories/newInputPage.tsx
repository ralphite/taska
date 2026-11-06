// The New input page as a whole (T661, the approved "Anchored Stream"), with the data its design was drawn and approved
// with: a day and a half of talking to taska, Chinese and English, voice notes, pictures, a file, every kind of
// outcome, one on its way and one waiting, a voice note being recorded and a draft to check. Every part is the page's
// own: the Sidebar, ComposeHead, Composer, the Draft card, SaidLately on the desktop and InputsView on the phone, with
// their rows from saidRows and inputRows.
import { sideProjects } from '../app/sideProjects'
import { ComposeHead } from '../features/composer/ComposeHead'
import { DraftCard, DRAFT_WORDS } from '../features/composer/DraftCard'
import { SaidLately } from '../features/composer/SaidLately'
import { InputsView } from '../features/inputs/InputsView'
import { inputRows, outgoingRows } from '../features/inputs/inputRows'
import { Sidebar } from '../features/sidebar/Sidebar'
import { SIDE_KEYS, sideLinks } from '../features/sidebar/sideLinks'
import type { HeardFile } from '../model/doubts'
import { draftKey } from '../model/draftTarget'
import { saidOutgoing, saidRows } from '../model/saidLately'
import type { FileRef, Input, OrgNote, ProjectRow } from '../model/types'
import { RecBar } from '../ui/PlaceVoice'
import { toneOf } from '../ui/tones'
import { boxAt, out } from './boxFixtures'
import { T, input, item, modelOf } from './fixtures'
import { Frame, PHONE } from './Frames'
import { talkEnv } from './itemFixtures'
import { sideOn } from './sideFixtures'
import { LiveWords } from './doubtsFixtures'
import { useInputs } from './inputFixtures'

// ---------------------------------------------------------------- the data

const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const org = (msg: string, f: Partial<OrgNote> = {}): OrgNote => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
/** a voice note and, once written out, its words (the input's text holds them too) */
const voice = (n: number, len: string, tr?: string): FileRef => ({ f: `f${n}-voice_${len}.webm`, name: `voice_${len}.webm`, mime: 'audio/webm', ...(tr === undefined ? {} : { tr }) })

const ITEMS = [
  item({ n: 479, status: 'doing', title: '搜索默认语音输入进行语义匹配' }),
  item({ n: 659, status: 'done', title: 'Input item 布局从左右两栏改为上下结构' }),
  item({ n: 642, type: 'task', status: 'doing', wait: { id: 1, kind: 'ask', text: 'Which first?', by: 'claude-code', files: [] }, title: 'Gemini 并行审查所有 Storybook 故事，按优先级列出设计缺陷' }),
  item({ n: 656, type: 'bug', status: 'done', title: '关联的 session 不去做任务分析' }),
  item({ n: 657, status: 'done', title: '悬浮菜单拆分为 comment 与原地录音 voice 两个按钮' }),
  item({ n: 447, type: 'idea', status: 'open', title: '创建 manager session 监听 Taska 任务并做 task delegation，防止卡住并统计 token/耗时' }),
  item({ n: 588, status: 'review', title: 'The export keeps the filter and the sort you set' }),
  item({ n: 651, type: 'bug', status: 'proposed', title: 'CSV 导出的列顺序和页面不一致' }),
]

const LONG =
  'new input，hover 的时候它有那个 add more 这个 button，我们应该把它拆成两个 button，一个是 comment，一个是 voice。这个有点像文档里面悬浮的时候一个情况。Comment 的话就直接是用 text input，就 input box。然后如果是 voice 的话，直接是就在原地一个 voice button 变成一个 recording 状态，然后就可以 record。我再点击一下就直接把这个语音的这个，然后用 add more 加到后面。这样的话两个动作都很直接，不用先打开菜单再选。'
const MANAGER =
  '这是一个 manager，它下面 manage 好几个 session，每一个 session 它的都是相互不关联的，没有任何关系的。绝对是要并行的。就 dev2 manager 它有明确的 instruction，你可以看一下 Taska 对于这样一个情况的 instruction。'

/** Newest first: today's, yesterday's, and the day before's. */
const INPUTS: Input[] = [
  input({ id: 'r1031', t: at(1), text: '', files: [voice(31, '0-12')], trWait: true }),
  input({ id: 'r1030', t: at(2), text: 'The export button does nothing on the orders page, see the screenshot.', files: [{ f: 'f90-orders-error.png', name: 'orders-error.png', mime: 'image/png', size: 145_408 }] }),
  input({ id: 'r1029', t: at(4), acked: true, touched: [479], text: '加上，我现在做桌面版本的设计。', files: [voice(29, '0-05', '加上，我现在做桌面版本的设计。')], org: org('Noted on F479') }),
  input({ id: 'r1028', t: at(12), text: '把 T642 的结果按优先级排好，先给我看 P0 的。', files: [voice(28, '0-09', '把 T642 的结果按优先级排好，先给我看 P0 的。')], org: org('Some commands failed: err: 503 Service Unavailable', { ok: false, changed: false }) }),
  input({ id: 'r1027', t: at(40), acked: true, touched: [659], text: 'Input item 现在的设计还是很有问题。我们现在分成两栏，像右边的这个状态，放在右边我觉得不合适，应该放在下面。不是左右，而是上下。', files: [voice(27, '0-28', 'Input item 现在的设计还是很有问题。我们现在分成两栏，像右边的这个状态，放在右边我觉得不合适，应该放在下面。不是左右，而是上下。')], org: org('Created F659') }),
  input({ id: 'r1026', t: at(55), acked: true, touched: [657], text: LONG, files: [voice(26, '1-00', LONG)], org: org('Created F657') }),
  input({ id: 'r1025', t: at(70), kind: 'cancelled', text: 'Maybe the inputs list should say each day once.', files: [voice(25, '0-04', 'Maybe the inputs list should say each day once.')] }),
  input({
    id: 'r1024',
    t: at(903),
    acked: true,
    kind: 'answer',
    scope: 642,
    text: 'Answered in D115:\n✓ 照建议改 (1. 事项页上半部分默认太矮，子事项被切掉)\n✓ 照建议改 (2. 手机上视图标签行两头的圆形箭头盖住标签)\n✓ 照建议改 (3. 手机输入框写多行时，文字被夹在按钮中间的窄条里)\n✗ 不改 (4. 侧栏项目颜色太接近)',
  }),
  input({ id: 'r1023', t: at(907), acked: true, touched: [656], text: MANAGER, files: [voice(23, '0-28', MANAGER)], org: org('Noted on B656') }),
  input({
    id: 'r1022',
    t: at(913),
    acked: true,
    touched: [656, 657],
    text: 'http://127.0.0.1:7340/p/dev2/F33\n为什么关联的 session 不去做这个，分析一下看是什么 bug。这个是 P0。',
    files: [{ f: 'f91-dev2-session.png', name: 'dev2-session.png', mime: 'image/png' }, voice(22, '0-07', '为什么关联的 session 不去做这个，分析一下看是什么 bug。'), voice(21, '0-03', '这个是 P0。')],
    org: org('Created B656 · Noted on F657'),
  }),
  input({ id: 'r1021', t: at(916), acked: true, text: '周末买菜：牛奶、鸡蛋、番茄。', moved: { to: 'home', as: 'r88' } }),
  input({ id: 'r1020', t: at(920), acked: true, kind: 'answer', scope: 447, text: '✓ 继续做 manager，在下面说要什么' }),
  input({ id: 'r1019', t: at(925), text: 'Look at why the build takes so long on the release branch.', org: org('Left for agent', { keep: true, changed: false }) }),
  input({ id: 'r1018', t: at(930), text: '把 coupon 那个 bug 关掉。', files: [voice(18, '0-03', '把 coupon 那个 bug 关掉。')], org: org('Created B660', { undone: true }) }),
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
  input({ id: 'r1015', t: at(60 * 51 + 28), acked: true, touched: [651], text: '这个 CSV 导出来列的顺序不对，跟页面上的不一样。', files: [{ f: 'f92-orders-export.csv', name: 'orders-export.csv', mime: 'text/csv', size: 34_816 }], org: org('Created B651') }),
]

/** One on its way and one waiting for Taska (Edit); × cancels either. */
const OUTBOX = [
  out({ q: 'q8', slug: 'taska', text: 'Also check the phone layout after that.', state: 'failed', net: true }),
  out({ q: 'q9', slug: 'taska', text: '把输入列表上面的搜索框去掉，用侧栏里的搜索。', state: 'sending' }),
]
const M = modelOf(ITEMS, INPUTS, { slug: 'taska', title: 'taska', organizer: { on: true, model: 'gemini-flash-latest', busy: ['r1030'] } })
const title = (slug: string) => ({ home: 'Home' })[slug] ?? slug
const DRAFTS = { [draftKey({ kind: 'amend', mode: 'edit', id: 'r1023' })]: 'my edit' }

/** The box's draft: a voice note's words, one word the two models heard differently, one the main model was unsure of. */
const DRAFT_TEXT = '把 Taska 的 new input 页面重新设计一下，列表要更容易扫，每条 input 变成了什么要一眼看到。'
const DRAFT_HEARD: HeardFile[] = [
  {
    key: 'v1',
    trAdded: DRAFT_TEXT,
    doubts: [
      { was: 'Taska', alt: 'Tasker', why: 'two models', show: ['Taska', 'Tasker'] },
      { was: '扫', alt: '', why: 'unsure' },
    ],
  },
]

// ---------------------------------------------------------------- the parts

const draftCard = (
  <DraftCard
    voice={1}
    ms={42_000}
    files={0}
    transcribing={false}
    hint={{ kind: 'check', n: 2 }}
    words={<LiveWords text={DRAFT_TEXT} heard={DRAFT_HEARD} className={DRAFT_WORDS} />}
  />
)

/** What you said lately under the box, as the desktop's page draws it, with what the page holds for it (useInputs:
 * More, ⋯ menus, Voice on a row, voice notes and pictures). One recording at a time, as the page has it: #1023's added
 * voice note (the box recording is a story of its own). */
function DeskList() {
  const live = useInputs(M, true, { adding: { id: 'r1023', clock: '0:11' } })
  const said = saidRows(M, { words: [], upTo: 30, opened: live.opened, drafts: DRAFTS, mode: null, title })
  return (
    <section aria-label="Latest inputs" className="mx-auto mt-8 block max-w-[42rem]">
      <SaidLately adding={live.adding ? { id: live.adding.id, meter: <RecBar time={live.adding.clock} levels={[0.3, 0.75, 0.5, 0.95, 0.4, 0.65]} /> } : null} rows={said.rows} outgoing={saidOutgoing(live.going(OUTBOX), [], 0)} more draft={draftCard} files={live.chips} words={live.words} on={live.saidOn} />
      {live.node}
    </section>
  )
}

const ROWS: ProjectRow[] = [
  { name: 'taska', title: 'taska', open: 5, needs: 3, pos: 0 },
  { name: 'home', title: 'Home', open: 13, needs: 2, pos: 1 },
  { name: 'shop', title: 'Shop', open: 9, needs: 0, pos: 2 },
]
const SIDE = sideProjects(ROWS, M, 'taska')

/** The desktop at 1440: the sidebar, and the New input page as the page's foot draws it there (the project's name,
 * the box, what you said). */
export function DeskPage() {
  return (
    <Frame layout="desk" width={1440}>
      <div data-compose className="group/app flex min-h-full bg-zinc-50 dark:bg-zinc-950">
        <div className="w-60 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <Sidebar phone={false} keys={SIDE_KEYS} projects={SIDE.list} composing links={sideLinks('taska', null)} place="" on={sideOn} />
        </div>
        <div className="min-w-0 flex-1 px-8 pt-12 pb-16">
          <ComposeHead title="taska" tone={toneOf(SIDE.tones, 'taska')} />
          <div className="[&>div]:bg-transparent [&>div]:p-0">{boxAt({ at: 'new' }, true, { placeholder: 'Write to taska…' })}</div>
          <DeskList />
        </div>
      </div>
    </Frame>
  )
}

/** The phone at 393: its Inputs tab, the box at its foot. */
export function PhonePage() {
  const live = useInputs(M, false, {})
  const { rows, total } = inputRows(M, { words: [], title, opened: live.opened, drafts: DRAFTS, writing: null, lit: null, litStill: false, upTo: 40 })
  return (
    <Frame layout="phone" width={PHONE.width}>
      <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
        <div data-phone-list className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <InputsView hidden={false} rows={rows} more={total > rows.length} outgoing={outgoingRows(live.going(OUTBOX), 'taska', 0)} words={[]} world={talkEnv(M, false).world} hints={null} files={live.chips} recording="0:07" on={live.inputOn} />
        </div>
        {live.node}
        <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800">{boxAt({ at: '' }, false, { placeholder: 'Write to taska…' })}</div>
      </div>
    </Frame>
  )
}
