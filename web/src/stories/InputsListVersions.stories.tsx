// B629: three ways to draw the list of what you said (under New input on the desktop, the Inputs tab on the phone), to
// pick from. The same inputs in each, worked out by the page's own saidRows; each version draws them its own way.
// Typed, spoken, with pictures, answers; filed into a new item, added to one, left for an agent, failed, moved,
// still being written out.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { SaidChip, SaidInput } from '../model/saidLately'
import type { FileRef, Input, OrgNote } from '../model/types'
import { Icon, StateIcon } from '../ui/Icon'
import { TYPE_TEXT } from '../ui/tones'
import { Frames } from './Frames'
import { PICTURE, T, input, item } from './fixtures'
import { saidData } from './inputFixtures'

export default { title: 'Prototype/B629 Inputs list', parameters: { layout: 'padded' } } satisfies Meta
type Story = StoryObj

// ---- the inputs, the same in every version
const ago = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const org = (msg: string, f: Partial<OrgNote> = {}): OrgNote => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
const voice = (d: string): FileRef => ({ f: `f9-voice_${d}.webm`, name: `voice_${d}.webm`, mime: 'audio/webm' })
const SHOT: FileRef = { f: 'f8-photo.png', name: 'photo.png', mime: 'image/png' }
const ITEMS = [
  item({ n: 38, type: 'task', title: '导出的文件丢了筛选条件' }),
  item({ n: 25, type: 'task', status: 'doing', title: '订单页加载太慢' }),
  item({ n: 14, type: 'bug', pri: 'P1', title: 'Coupon box hidden behind the keyboard' }),
  item({ n: 37, type: 'task', status: 'done', title: '设置页的开关对不齐' }),
  item({ n: 7, type: 'task', title: 'Which formats should the export offer?' }),
]
const INPUTS: Input[] = [
  input({ id: 'r71', t: ago(1), text: '', files: [voice('0-12')], trWait: true }),
  input({ id: 'r70', t: ago(4), acked: true, touched: [38], files: [voice('0-28')], text: '我在订单页设了筛选再导出，导出来的 CSV 里还是全部订单，筛选条件没有带过去。应该只导出我筛出来的那些。', org: org('Created T038') }),
  input({ id: 'r69', t: ago(160), acked: true, touched: [25], files: [voice('0-16')], text: '订单页打开要等好几秒，特别是订单多的时候。看看能不能先显示前面一部分。', org: org('Added to T025') }),
  input({ id: 'r68', t: ago(300), acked: true, touched: [14], files: [SHOT], text: 'The coupon box hides behind the keyboard on the phone.', org: org('Created B014') }),
  input({ id: 'r67', t: ago(420), text: 'Look at why the build takes so long.', org: org('Left for your agent', { keep: true, changed: false }) }),
  input({ id: 'r66', t: ago(60 * 24 + 30), acked: true, touched: [37], files: [SHOT, voice('0-10')], text: '设置页里这几个开关没对齐，看截图。', org: org('Created T037') }),
  input({ id: 'r65', t: ago(60 * 24 + 90), acked: true, kind: 'answer', scope: 7, text: 'CSV and Excel.' }),
  input({ id: 'r64', t: ago(60 * 24 + 200), text: 'The coupon box is in the way.', org: org('B99 is not in this project', { ok: false, changed: false }) }),
  input({ id: 'r63', t: ago(60 * 72), acked: true, text: 'The app icon looks blurry on the home screen.', moved: { to: 'mobile-app', as: 'r4' } }),
  input({ id: 'r62', t: ago(60 * 74), acked: true, touched: [14], org: org('Added to B014'), text: Array.from({ length: 6 }, (_, i) => `Step ${i + 1}: open the cart on the phone, tap the coupon box, the keyboard covers it.`).join('\n') }),
]
const said = () => saidData({ inputs: INPUTS, organizer: true }, ITEMS)

// ---- small parts the versions share
const voiceOf = (r: Input) => r.files.find((f) => f.mime?.startsWith('audio/'))
const picsOf = (r: Input) => r.files.filter((f) => f.mime?.startsWith('image/'))
const length = (f: FileRef) => (/voice_(\d+)-(\d+)/.exec(f.name) ?? []).slice(1).join(':')
const failed = (x: SaidInput) => !!x.r.org && !x.r.org.ok
/** what an input needs from you: it failed or is still on its way */
const needsYou = (x: SaidInput) => failed(x)
const withAgent = (x: SaidInput) => !!x.r.org?.keep && !x.r.acked

function Voice({ f, small = false }: { f: FileRef; small?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ${small ? 'h-6 pr-2 pl-1 text-[11px]' : 'h-8 pr-3 pl-1 text-xs'}`}>
      <span className={`grid place-items-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ${small ? 'size-4' : 'size-6'}`}>
        <Icon n="play" c={small ? 'size-2.5' : 'size-3'} />
      </span>
      {length(f)}
    </span>
  )
}
const Pic = ({ size = 'size-12' }: { size?: string }) => <img src={PICTURE} alt="" className={`${size} shrink-0 rounded-lg object-cover ring-1 ring-black/5`} />

function ItemChip({ c, plain = false }: { c: SaidChip; plain?: boolean }) {
  return (
    <span className={`flex h-7 min-w-0 items-center gap-1.5 rounded-lg text-[13px] text-zinc-800 dark:text-zinc-200 ${plain ? '' : 'bg-zinc-100 pr-2.5 pl-1.5 dark:bg-zinc-800'}`}>
      <StateIcon {...c.status} cls="size-4 shrink-0" />
      <span className={`shrink-0 font-mono text-xs font-bold ${TYPE_TEXT[c.type]}`}>{c.code}</span>
      <span className="truncate">{c.title}</span>
    </span>
  )
}

/** where an input stands, in words with its mark */
function Standing({ x }: { x: SaidInput }) {
  const s = x.standing
  return (
    <span className={`flex min-w-0 items-center gap-1 text-[13px] font-medium ${s.tone}`}>
      {s.icon === 'dot' ? <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-current" /> : <Icon n={s.icon} c="size-3.5 shrink-0" sw="2" />}
      <span className="truncate">{s.label}</span>
    </span>
  )
}

/** what became of it: its items, or where it stands when it made none */
function Became({ x, plain = false }: { x: SaidInput; plain?: boolean }) {
  if (x.scope) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
        <Icon n="check" c="size-3.5 shrink-0" sw="2" />
        <span className="shrink-0">Answer to</span>
        <ItemChip c={x.scope} plain />
      </span>
    )
  }
  if (x.chips.length) return <>{x.chips.map((c) => <ItemChip key={c.n} c={c} plain={plain} />)}</>
  return <Standing x={x} />
}

const ACT = 'flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700'
function Acts({ x }: { x: SaidInput }) {
  return (
    <>
      {failed(x) ? (
        <button className={`${ACT} text-blue-600 dark:text-blue-400`}>
          <Icon n="loop" c="size-3.5" sw="2" />
          Try again
        </button>
      ) : null}
      {x.r.moved ? null : (
        <button className={ACT}>
          <Icon n="plus" c="size-3.5" sw="2" />
          Add more
        </button>
      )}
      <button className={ACT} aria-label="More">
        <Icon n="more" c="size-4" />
      </button>
    </>
  )
}

function SearchField({ wide = true }: { wide?: boolean }) {
  return (
    <label className={`flex h-9 items-center gap-2 rounded-lg bg-zinc-100 px-2.5 text-sm text-zinc-400 dark:bg-zinc-800 ${wide ? 'w-64' : 'min-w-0 flex-1'}`}>
      <Icon n="search" c="size-4 shrink-0" />
      Search inputs
    </label>
  )
}

const KIND_ICON = (r: Input) => (r.kind === 'answer' ? 'check' : voiceOf(r) ? 'mic' : picsOf(r).length ? 'image' : 'pencil')

// ---- version A: a ledger, one line each
function Ledger({ desk }: { desk: boolean }) {
  const { rows, total } = said()
  const [open, setOpen] = useState<string | null>('r70')
  const [view, setView] = useState('all')
  const views: [string, string, (x: SaidInput) => boolean][] = [
    ['all', 'All', () => true],
    ['needs', 'Needs you', needsYou],
    ['agent', 'With agent', withAgent],
    ['filed', 'Filed', (x) => x.chips.length > 0],
  ]
  const shown = rows.filter((views.find((v) => v[0] === view) ?? views[0])[2])
  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-3 pb-3 ${desk ? '' : 'px-4 pt-3'}`}>
        <h2 className="text-[15px] font-semibold">
          Inputs <span className="font-normal text-zinc-400">{total}</span>
        </h2>
        {desk ? <span className="flex-1" /> : null}
        <SearchField wide={desk} />
      </div>
      <div className={`flex gap-1.5 pb-2 ${desk ? '' : 'px-4'}`}>
        {views.map(([k, name, f]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            aria-pressed={view === k}
            className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white aria-pressed:ring-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
          >
            {name}
            <span className="tabular-nums opacity-60">{rows.filter(f).length}</span>
          </button>
        ))}
      </div>
      <ul className="divide-y divide-zinc-100 border-y border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
        {shown.map((x) => {
          const r = x.r
          const v = voiceOf(r)
          const pics = picsOf(r)
          const isOpen = open === r.id
          return (
            <li key={r.id} className={`group/row relative ${isOpen ? 'bg-zinc-50 dark:bg-zinc-900' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/60'}`}>
              <button onClick={() => setOpen(isOpen ? null : r.id)} className={`w-full text-left ${desk ? 'grid grid-cols-[3.25rem_1rem_minmax(0,1fr)_minmax(0,15rem)_6.75rem] items-center gap-3 px-3 py-2.5' : 'flex flex-col gap-1 px-4 py-3'}`}>
                {desk ? (
                  <>
                    <span className="font-mono text-[13px] font-bold text-zinc-800 dark:text-zinc-200">{x.code}</span>
                    <Icon n={KIND_ICON(r)} c="size-4 text-zinc-400" />
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="truncate">{r.text || <i className="text-zinc-400">Voice note</i>}</span>
                      {v ? <Voice f={v} small /> : null}
                      {pics.length ? <Pic size="size-6" /> : null}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Became x={x} plain />
                    </span>
                    <span className="text-right text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">{x.time}</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{x.code}</span>
                      <Icon n={KIND_ICON(r)} c="size-3.5" />
                      {v ? length(v) : null}
                      <span className="ml-auto tabular-nums">{x.time}</span>
                    </span>
                    <span className={`text-[15px] leading-snug ${isOpen ? '' : 'line-clamp-2'}`}>{r.text || <i className="text-zinc-400">Voice note</i>}</span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Became x={x} plain />
                    </span>
                  </>
                )}
              </button>
              {desk && !isOpen ? (
                <span className="invisible absolute inset-y-0 right-2 flex items-center gap-0.5 bg-zinc-50 pl-3 group-hover/row:visible dark:bg-zinc-900">
                  <Acts x={x} />
                </span>
              ) : null}
              {isOpen ? (
                <div className={`flex flex-col gap-3 pb-4 ${desk ? 'pr-3 pl-[5.75rem]' : 'px-4'}`}>
                  {desk ? <p className="text-[15px] leading-relaxed whitespace-pre-line">{r.text}</p> : null}
                  {v || pics.length ? (
                    <div className="flex items-center gap-2">
                      {pics.map((p) => (
                        <Pic key={p.f} />
                      ))}
                      {v ? <Voice f={v} /> : null}
                    </div>
                  ) : null}
                  {failed(x) ? <p className="text-[13px] text-red-600 dark:text-red-400">{r.org?.msg}</p> : null}
                  <div className="-ml-2 flex flex-wrap items-center gap-0.5">
                    <Acts x={x} />
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---- version B: what you said beside what it became
function Pairs({ desk }: { desk: boolean }) {
  const { rows, total } = said()
  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-3 pb-3 ${desk ? '' : 'px-4 pt-3'}`}>
        <h2 className="text-[15px] font-semibold">
          Inputs <span className="font-normal text-zinc-400">{total}</span>
        </h2>
        {desk ? <span className="flex-1" /> : null}
        <SearchField wide={desk} />
      </div>
      <ul className={`flex flex-col gap-3 ${desk ? '' : 'px-3'}`}>
        {rows.map((x) => {
          const r = x.r
          const v = voiceOf(r)
          const pics = picsOf(r)
          return (
            <li key={r.id} className={`group/row overflow-hidden rounded-2xl bg-white ring-1 dark:bg-zinc-900 ${failed(x) ? 'ring-red-200 dark:ring-red-400/30' : 'ring-zinc-200 dark:ring-zinc-800'} ${desk ? 'grid grid-cols-[minmax(0,1fr)_15rem]' : 'flex flex-col'}`}>
              <div className="flex min-w-0 flex-col gap-2 p-4">
                <div className="flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{x.code}</span>
                  <span>·</span>
                  <span className="tabular-nums">{x.time}</span>
                  <span className="ml-auto flex items-center gap-0.5 lg:invisible lg:group-hover/row:visible">
                    <button className={ACT} aria-label="More">
                      <Icon n="more" c="size-4" />
                    </button>
                  </span>
                </div>
                {r.text ? <p className="line-clamp-3 text-[15px] leading-relaxed whitespace-pre-line">{r.text}</p> : <p className="text-[15px] text-zinc-400 italic">Voice note, being written out…</p>}
                {v || pics.length ? (
                  <div className="flex items-center gap-2">
                    {pics.map((p) => (
                      <Pic key={p.f} />
                    ))}
                    {v ? <Voice f={v} /> : null}
                  </div>
                ) : null}
              </div>
              <div className={`flex min-w-0 flex-col gap-1.5 bg-zinc-50 px-4 py-3 dark:bg-zinc-800/40 ${desk ? 'border-l border-zinc-100 dark:border-zinc-800' : 'border-t border-zinc-100 dark:border-zinc-800'}`}>
                <span className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">{x.chips.length ? 'Became' : x.scope ? 'Answered' : 'Now'}</span>
                {x.scope ? <ItemChip c={x.scope} /> : x.chips.length ? x.chips.map((c) => <ItemChip key={c.n} c={c} />) : <Standing x={x} />}
                {failed(x) ? (
                  <>
                    <span className="text-[13px] text-red-600 dark:text-red-400">{r.org?.msg}</span>
                    <button className={`${ACT} -ml-2 self-start text-blue-600 dark:text-blue-400`}>
                      <Icon n="loop" c="size-3.5" sw="2" />
                      Try again
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---- version C: a conversation with Taska, the latest at the bottom by the box
function Talk({ desk }: { desk: boolean }) {
  const rows = [...said().rows].reverse()
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  return (
    <div className="flex h-[700px] flex-col">
      <div className={`flex items-center gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800 ${desk ? '' : 'px-4 pt-3'}`}>
        <h2 className="text-[15px] font-semibold">Inputs</h2>
        {desk ? <span className="flex-1" /> : null}
        <SearchField wide={desk} />
      </div>
      <div ref={box} className={`flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-5 ${desk ? 'px-2' : 'px-3'}`}>
        {rows.map((x) => {
          const r = x.r
          const v = voiceOf(r)
          const pics = picsOf(r)
          return (
            <div key={r.id} className="group/row flex flex-col gap-1.5">
              <div className="flex flex-col items-end gap-1">
                <div className="flex max-w-[85%] flex-col items-end gap-1.5">
                  {pics.length || v ? (
                    <div className="flex items-center gap-2">
                      {pics.map((p) => (
                        <Pic key={p.f} size="size-16" />
                      ))}
                      {v ? <Voice f={v} /> : null}
                    </div>
                  ) : null}
                  {r.text ? <p className="rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-line text-white">{r.text}</p> : null}
                </div>
                <span className="flex items-center gap-1.5 text-[12px] text-zinc-400 tabular-nums">
                  <span className="hidden items-center gap-0.5 group-hover/row:flex">
                    <button className={ACT}>Add more</button>
                    <button className={ACT} aria-label="More">
                      <Icon n="more" c="size-4" />
                    </button>
                  </span>
                  <span className="font-mono font-semibold text-zinc-500">{x.code}</span>· {x.time}
                </span>
              </div>
              <div className="flex max-w-[85%] items-start gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">T</span>
                <div className="flex min-w-0 flex-col gap-1 rounded-2xl rounded-tl-md bg-zinc-100 px-3 py-2 text-[13px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {x.scope ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      Your answer to <ItemChip c={x.scope} plain />
                    </span>
                  ) : x.chips.length ? (
                    <>
                      <span>{r.org?.msg.startsWith('Added') ? 'Added to' : 'Filed as'}</span>
                      {x.chips.map((c) => (
                        <ItemChip key={c.n} c={c} plain />
                      ))}
                    </>
                  ) : (
                    <Standing x={x} />
                  )}
                  {failed(x) ? (
                    <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      {r.org?.msg}
                      <button className="font-medium text-blue-600 dark:text-blue-400">Try again</button>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className={`flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700 ${desk ? '' : 'mx-3 mb-3'}`}>
        <span className="flex-1 text-[15px] text-zinc-400">Write or speak…</span>
        <span className="grid size-9 place-items-center rounded-full text-zinc-500">
          <Icon n="mic" c="size-5" />
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Icon n="up" c="size-5" />
        </span>
      </div>
    </div>
  )
}

const both = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => <Frames deskWidth={820} height={760}>{(layout) => <div className={layout === 'desk' ? 'h-full overflow-y-auto p-6' : 'h-full'}>{draw(layout === 'desk')}</div>}</Frames>,
})

/** A: one line each, like an inbox: its number, what kind it is, its words, what became of it, its day and time, in
 * columns; views by where they stand; a click opens one in place. */
export const A: Story = { ...both((desk) => <Ledger desk={desk} />), name: 'A: one line each (an inbox)' }
/** B: each input a card, what you said on the left and what became of it on the right. */
export const B: Story = { ...both((desk) => <Pairs desk={desk} />), name: 'B: what you said beside what it became' }
/** C: a conversation with Taska: what you said in your bubbles, what Taska did with it answering; the latest at the
 * bottom, by the box. */
export const C: Story = { ...both((desk) => <Talk desk={desk} />), name: 'C: a conversation with Taska' }
