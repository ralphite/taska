// B629: three ways to draw the list of what you said (under New input on the desktop, the Inputs tab on the phone), to
// pick from. The same inputs in each, worked out by the page's own saidRows, and the same small parts in each (what
// came with it, what became of it, its buttons), so the versions differ only in their layout. Typed, spoken, with a
// picture, an answer; filed into a new item, added to one, left for an agent, failed, moved, still being written out.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { SaidInput } from '../model/saidLately'
import type { FileRef, Input, OrgNote } from '../model/types'
import { Icon, StateIcon } from '../ui/Icon'
import { TYPE_TEXT } from '../ui/tones'
import { Frames } from './Frames'
import { input, item } from './fixtures'
import { saidData } from './inputFixtures'

export default { title: 'Prototype/B629 Inputs list', parameters: { layout: 'padded' } } satisfies Meta
type Story = StoryObj

// ---- the inputs, the same in every version (their times count back from now, so they read Today, Yesterday, ...)
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const org = (msg: string, f: Partial<OrgNote> = {}): OrgNote => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
const voice = (d: string): FileRef => ({ f: `f9-voice_${d}.webm`, name: `voice_${d}.webm`, mime: 'audio/webm' })
const SHOT: FileRef = { f: 'f8-settings.png', name: 'settings.png', mime: 'image/png' }
const ITEMS = [
  item({ n: 38, type: 'bug', title: '导出的文件丢了筛选条件' }),
  item({ n: 25, type: 'task', status: 'doing', title: '订单页加载太慢' }),
  item({ n: 14, type: 'bug', pri: 'P1', title: 'Coupon box hidden behind the keyboard' }),
  item({ n: 37, type: 'bug', status: 'done', title: '设置页的开关对不齐' }),
  item({ n: 7, type: 'task', title: 'Which formats should the export offer?' }),
]
const INPUTS: Input[] = [
  input({ id: 'r71', t: ago(1), text: '', files: [voice('0-12')], trWait: true }),
  input({ id: 'r70', t: ago(4), acked: true, touched: [38], files: [voice('0-28')], text: '我在订单页设了筛选再导出，导出来的 CSV 里还是全部订单，筛选条件没有带过去。应该只导出我筛出来的那些。', org: org('Created B038') }),
  input({ id: 'r69', t: ago(160), acked: true, touched: [25], files: [voice('0-16')], text: '订单页打开要等好几秒，特别是订单多的时候。看看能不能先显示前面一部分。', org: org('Added to T025') }),
  input({ id: 'r68', t: ago(300), acked: true, touched: [14], files: [SHOT], text: 'The coupon box hides behind the keyboard on the phone.', org: org('Created B014') }),
  input({ id: 'r67', t: ago(420), text: 'Look at why the build takes so long.', org: org('Left for your agent', { keep: true, changed: false }) }),
  input({ id: 'r66', t: ago(60 * 24 + 30), acked: true, touched: [37], files: [SHOT, voice('0-10')], text: '设置页里这几个开关没对齐，看截图。', org: org('Created B037') }),
  input({ id: 'r65', t: ago(60 * 24 + 90), acked: true, kind: 'answer', scope: 7, text: 'CSV and Excel.' }),
  input({ id: 'r64', t: ago(60 * 24 + 200), text: 'The coupon box is in the way.', org: org('B99 is not in this project', { ok: false, changed: false }) }),
  input({ id: 'r63', t: ago(60 * 72), acked: true, text: 'The app icon looks blurry on the home screen.', moved: { to: 'mobile-app', as: 'r4' } }),
  input({ id: 'r62', t: ago(60 * 74), acked: true, touched: [14], org: org('Added to B014'), text: Array.from({ length: 6 }, (_, i) => `Step ${i + 1}: open the cart on the phone, tap the coupon box, the keyboard covers it.`).join('\n') }),
]
const said = () => saidData({ inputs: INPUTS, organizer: true }, ITEMS)

// ---- what each input holds and where it stands
const voiceOf = (r: Input) => r.files.find((f) => f.mime?.startsWith('audio/'))
const picsOf = (r: Input) => r.files.filter((f) => f.mime?.startsWith('image/'))
const length = (f: FileRef) => (/voice_(\d+)-(\d+)/.exec(f.name) ?? []).slice(1).join(':')
const failed = (x: SaidInput) => !!x.r.org && !x.r.org.ok
const busy = (x: SaidInput) => !!x.r.trWait
const leftForAgent = (x: SaidInput) => !!x.r.org?.keep && !x.r.acked
const words = (r: Input) => r.text || (voiceOf(r) ? 'Voice note' : '')

// ---- small parts, the same in every version
/** a screenshot as a picture shows it: a small light page with a bar and a few lines */
const SHOT_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#f4f4f5"/><rect x="14" y="14" width="92" height="12" rx="3" fill="#d4d4d8"/><rect x="14" y="36" width="70" height="8" rx="2" fill="#e4e4e7"/><rect x="14" y="52" width="80" height="8" rx="2" fill="#e4e4e7"/><rect x="84" y="66" width="22" height="12" rx="6" fill="#2563eb"/><rect x="14" y="68" width="60" height="8" rx="2" fill="#e4e4e7"/><rect x="84" y="88" width="22" height="12" rx="6" fill="#a1a1aa"/><rect x="14" y="90" width="52" height="8" rx="2" fill="#e4e4e7"/></svg>',
  )

/** what came with it, in a few words: its voice note's length, how many pictures */
function Extras({ r }: { r: Input }) {
  const v = voiceOf(r)
  const pics = picsOf(r).length
  if (!v && !pics) return null
  return (
    <span className="flex shrink-0 items-center gap-2 text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">
      {v ? (
        <span className="flex items-center gap-0.5">
          <Icon n="mic" c="size-3.5" />
          {length(v)}
        </span>
      ) : null}
      {pics ? (
        <span className="flex items-center gap-0.5">
          <Icon n="image" c="size-3.5" />
          {pics}
        </span>
      ) : null}
    </span>
  )
}

/** the voice note to play and the pictures, as they are when an input is open */
function Media({ r, onBlue = false }: { r: Input; onBlue?: boolean }) {
  const v = voiceOf(r)
  const pics = picsOf(r)
  if (!v && !pics.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pics.map((p) => (
        <img key={p.f} src={SHOT_URL} alt="" className={`size-16 rounded-lg object-cover ${onBlue ? 'ring-1 ring-white/40' : 'ring-1 ring-black/10'}`} />
      ))}
      {v ? (
        <span className={`inline-flex h-8 items-center gap-2 rounded-full pr-3 pl-1 font-mono text-xs tabular-nums ${onBlue ? 'bg-white/15 text-white' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
          <span className={`grid size-6 place-items-center rounded-full ${onBlue ? 'bg-white text-blue-600' : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'}`}>
            <Icon n="play" c="size-3" />
          </span>
          {length(v)}
        </span>
      ) : null}
    </div>
  )
}

const BTN = 'flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700'
const TRY = 'flex h-6 shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2 text-[13px] font-medium text-white hover:bg-blue-700'

/** an item it made or went to: its mark, code and title on one line */
function ItemLine({ c }: { c: NonNullable<SaidInput['scope']> }) {
  return (
    <span className="flex h-6 min-w-0 items-center gap-1.5 text-[13px] text-zinc-800 dark:text-zinc-200">
      <StateIcon {...c.status} cls="size-4 shrink-0" />
      <span className={`shrink-0 font-mono text-xs font-bold ${TYPE_TEXT[c.type]}`}>{c.code}</span>
      <span className="truncate">{c.title}</span>
    </span>
  )
}

/** what became of it: the items it made or went to, its answer's item, or where it stands; a failed one says so,
 * with Try again */
function Outcome({ x }: { x: SaidInput }) {
  const label = (icon: 'dot' | 'bot' | 'arrow' | 'alert' | 'check', text: string, tone: string) => (
    <span className={`flex h-6 min-w-0 items-center gap-1.5 text-[13px] font-medium ${tone}`}>
      {icon === 'dot' ? <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-current" /> : <Icon n={icon} c="size-3.5 shrink-0" sw="2" />}
      <span className="truncate">{text}</span>
    </span>
  )
  const lines: ReactNode[] = []
  if (busy(x)) lines.push(<span key="b">{label('dot', 'Being written out', 'text-blue-600 dark:text-blue-400')}</span>)
  else if (failed(x)) {
    lines.push(
      <span key="f" className="flex min-w-0 items-center gap-2">
        {label('alert', 'Not filed', 'text-red-600 dark:text-red-400')}
        <button className={TRY}>Try again</button>
      </span>,
    )
  } else if (x.r.moved) lines.push(<span key="m">{label('arrow', 'Moved to Mobile app', 'text-zinc-500 dark:text-zinc-400')}</span>)
  else if (x.scope) {
    lines.push(
      <span key="a" className="flex min-w-0 items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
        <span className="shrink-0">Answer to</span>
        <ItemLine c={x.scope} />
      </span>,
    )
  } else if (x.chips.length) for (const c of x.chips) lines.push(<ItemLine key={c.n} c={c} />)
  else if (leftForAgent(x)) lines.push(<span key="l">{label('bot', 'Left for agent', 'text-zinc-500 dark:text-zinc-400')}</span>)
  else lines.push(<span key="s">{label('check', x.standing.label, 'text-zinc-500 dark:text-zinc-400')}</span>)
  return <div className="flex min-w-0 flex-col gap-0.5">{lines}</div>
}

/** its buttons: Add more (not for one moved away) and the menu; `menuOnly`: the menu alone, Add more in it (the
 * phone's rows, where a button on every row crowds it) */
function Acts({ x, menuOnly = false }: { x: SaidInput; menuOnly?: boolean }) {
  return (
    <span className="flex shrink-0 items-center">
      {x.r.moved || menuOnly ? null : (
        <button className={BTN}>
          <Icon n="plus" c="size-3.5" sw="2" />
          Add more
        </button>
      )}
      <button className={BTN} aria-label="More">
        <Icon n="more" c="size-4" />
      </button>
    </span>
  )
}

function Head({ desk, total }: { desk: boolean; total: number }) {
  return (
    <div className={`flex items-center gap-3 ${desk ? 'pb-4' : 'px-4 pt-3 pb-3'}`}>
      <h2 className="shrink-0 text-[17px] font-semibold">
        Inputs <span className="font-normal text-zinc-400 tabular-nums">{total}</span>
      </h2>
      <label className={`ml-auto flex h-9 items-center gap-2 rounded-lg bg-zinc-100 px-2.5 text-sm text-zinc-400 dark:bg-zinc-800 ${desk ? 'w-64' : 'min-w-0 flex-1'}`}>
        <Icon n="search" c="size-4 shrink-0" />
        Search inputs
      </label>
    </div>
  )
}

const TIME = 'shrink-0 text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400'
const CODE = 'shrink-0 font-mono text-[13px] font-bold text-zinc-900 dark:text-zinc-100'

// ---- A: one line each, like an inbox
function Ledger({ desk }: { desk: boolean }) {
  const { rows, total } = said()
  const [open, setOpen] = useState<string | null>('r70')
  const [view, setView] = useState('all')
  const views: [string, string, (x: SaidInput) => boolean][] = [
    ['all', 'All', () => true],
    ['needs', 'Needs you', failed],
    ['agent', 'Left for agent', leftForAgent],
    ['filed', 'Filed', (x) => x.chips.length > 0],
  ]
  const shown = rows.filter((views.find((v) => v[0] === view) ?? views[0])[2])
  return (
    <div className="flex flex-col">
      <Head desk={desk} total={total} />
      <div className={`flex gap-1.5 overflow-x-auto pb-3 ${desk ? '' : 'px-4'}`}>
        {views.map(([k, name, f]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            aria-pressed={view === k}
            className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white aria-pressed:ring-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
          >
            {name}
            <span className="tabular-nums opacity-60">{rows.filter(f).length}</span>
          </button>
        ))}
      </div>
      <ul className="divide-y divide-zinc-100 border-y border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
        {shown.map((x) => {
          const r = x.r
          const isOpen = open === r.id
          const text = words(r)
          return (
            <li key={r.id} className={`group/row relative ${isOpen ? 'bg-zinc-50 dark:bg-zinc-900' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/60'}`}>
              {desk ? (
                <div onClick={() => setOpen(isOpen ? null : r.id)} className="grid cursor-pointer grid-cols-[3.25rem_minmax(0,1fr)_15rem_6.5rem] items-baseline gap-3 px-3 py-2.5">
                  <span className={`${CODE} leading-6`}>{x.code}</span>
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="flex min-w-0 items-center gap-2 leading-6">
                      <span className={`min-w-0 text-sm ${isOpen ? 'whitespace-pre-line' : 'truncate'} ${r.text ? '' : 'text-zinc-400 italic'}`}>{text}</span>
                      {isOpen ? null : <Extras r={r} />}
                    </span>
                    {isOpen ? <Media r={r} /> : null}
                    {isOpen ? (
                      <div className="-ml-2" onClick={(e) => e.stopPropagation()}>
                        <Acts x={x} />
                      </div>
                    ) : null}
                  </div>
                  <div onClick={(e) => failed(x) && e.stopPropagation()}>
                    <Outcome x={x} />
                  </div>
                  <span className={`${TIME} text-right leading-6`}>{x.time}</span>
                </div>
              ) : (
                <div onClick={() => setOpen(isOpen ? null : r.id)} className="flex cursor-pointer flex-col gap-1.5 px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className={CODE}>{x.code}</span>
                    <Extras r={r} />
                    <span className={`${TIME} ml-auto`}>{x.time}</span>
                  </span>
                  <span className={`text-[15px] leading-snug ${isOpen ? 'whitespace-pre-line' : 'line-clamp-2'} ${r.text ? '' : 'text-zinc-400 italic'}`}>{text}</span>
                  {isOpen ? <Media r={r} /> : null}
                  <Outcome x={x} />
                  {isOpen ? (
                    <div className="-ml-2" onClick={(e) => e.stopPropagation()}>
                      <Acts x={x} />
                    </div>
                  ) : null}
                </div>
              )}
              {desk && !isOpen ? (
                <span className="invisible absolute top-2 right-2 flex items-center rounded-lg bg-zinc-50 pl-2 group-hover/row:visible dark:bg-zinc-900">
                  <Acts x={x} />
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---- B: what you said beside what became of it
function Pairs({ desk }: { desk: boolean }) {
  const { rows, total } = said()
  return (
    <div className="flex flex-col">
      <Head desk={desk} total={total} />
      <ul className={`flex flex-col gap-3 ${desk ? '' : 'px-3 pb-4'}`}>
        {rows.map((x) => {
          const r = x.r
          return (
            <li
              key={r.id}
              className={`group/row overflow-hidden rounded-2xl bg-white ring-1 dark:bg-zinc-900 ${failed(x) ? 'ring-red-200 dark:ring-red-400/30' : 'ring-zinc-200 dark:ring-zinc-800'} ${desk ? 'grid grid-cols-[minmax(0,1fr)_17rem]' : 'flex flex-col'}`}
            >
              <div className="flex min-w-0 flex-col gap-2 px-4 pt-3 pb-4">
                <div className="flex h-7 items-center gap-2">
                  <span className={CODE}>{x.code}</span>
                  <span className={TIME}>{x.time}</span>
                  <span className={`ml-auto ${desk ? 'invisible group-hover/row:visible' : ''}`}>
                    <Acts x={x} menuOnly={!desk} />
                  </span>
                </div>
                <p className={`line-clamp-3 text-[15px] leading-relaxed whitespace-pre-line ${r.text ? '' : 'text-zinc-400 italic'}`}>{words(r)}</p>
                <Media r={r} />
              </div>
              <div
                className={`flex min-w-0 flex-col gap-1 bg-zinc-50 px-4 py-3 dark:bg-zinc-800/40 ${desk ? 'border-l border-zinc-100 dark:border-zinc-800' : 'border-t border-zinc-100 dark:border-zinc-800'}`}
              >
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{x.chips.length ? 'Became' : x.scope ? 'Answered' : 'Status'}</span>
                <Outcome x={x} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---- C: a conversation with Taska, the latest at the bottom by the box
function Talk({ desk }: { desk: boolean }) {
  const rows = [...said().rows].reverse()
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  return (
    <div className={`flex flex-col ${desk ? 'h-[740px]' : 'h-[836px]'}`}>
      <div className="border-b border-zinc-100 dark:border-zinc-800">
        <Head desk={desk} total={rows.length} />
      </div>
      <div ref={box} className={`flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto py-5 ${desk ? 'px-1' : 'px-3'}`}>
        {rows.map((x) => {
          const r = x.r
          return (
            <div key={r.id} className="group/row flex flex-col gap-2">
              <div className="flex flex-col items-end gap-1">
                <div className={`flex flex-col gap-2 rounded-2xl rounded-tr-md bg-blue-600 px-4 py-2.5 text-[15px] leading-relaxed text-white ${desk ? 'max-w-[70%]' : 'max-w-[85%]'}`}>
                  {r.text ? <p className="whitespace-pre-line">{r.text}</p> : <p className="text-white/80 italic">{words(r)}</p>}
                  <Media r={r} onBlue />
                </div>
                <span className="flex h-7 items-center gap-1">
                  <span className={desk ? 'invisible group-hover/row:visible' : ''}>
                    <Acts x={x} menuOnly={!desk} />
                  </span>
                  <span className={CODE}>{x.code}</span>
                  <span className={TIME}>· {x.time}</span>
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <Icon n="logo" c="size-4" />
                </span>
                <div className={`flex min-w-0 flex-col gap-0.5 rounded-2xl rounded-tl-md bg-zinc-100 px-3 py-2 dark:bg-zinc-800 ${desk ? 'max-w-[70%]' : 'max-w-[85%]'}`}>
                  {x.chips.length ? <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{r.org?.msg.startsWith('Added') ? 'Added to' : 'Filed as'}</span> : null}
                  <Outcome x={x} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className={`flex items-end gap-2 rounded-3xl bg-white p-2 pl-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700 ${desk ? 'mt-2' : 'mx-3 mb-3'}`}>
        <span className="grid size-9 shrink-0 place-items-center text-zinc-500">
          <Icon n="plus" c="size-5" />
        </span>
        <span className="flex h-9 min-w-0 flex-1 items-center text-[15px] text-zinc-400">Write to Shop…</span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Icon n="mic" c="size-5" />
        </span>
      </div>
    </div>
  )
}

const both = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => <Frames deskWidth={860} height={800}>{(layout) => <div className={layout === 'desk' ? 'h-full overflow-y-auto p-6' : 'h-full overflow-y-auto'}>{draw(layout === 'desk')}</div>}</Frames>,
})

/** A: one line each, like an inbox: its number, its words with what came with them, what became of it, its day and
 * time, in columns; views by where they stand; a click opens one in place (its words whole, its voice note and
 * pictures, its buttons). */
export const A: Story = { ...both((desk) => <Ledger desk={desk} />), name: 'A: one line each (an inbox)' }
/** B: each input a card, what you said on the left and what became of it on the right. */
export const B: Story = { ...both((desk) => <Pairs desk={desk} />), name: 'B: what you said beside what it became' }
/** C: a conversation with Taska: what you said in your bubbles, what Taska did with it answering; the latest at the
 * bottom, by the box. */
export const C: Story = { ...both((desk) => <Talk desk={desk} />), name: 'C: a conversation with Taska' }
