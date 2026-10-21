// Settings (B162): one page for everything you change now and then; each section has its own address. On the desktop
// a column of sections and the section beside it; on the phone pages in the grouped style of a phone's own settings.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  AGENT_NAME,
  CHIP,
  FIELD,
  LOG_N,
  PRIMARY,
  P_BTN,
  SECOND,
  STATUS,
  TAB_NAME,
  TYPE_TEXT,
  WHEN,
} from '../lib/constants'
import {
  D,
  U,
  agentState,
  agoLong,
  bump,
  byN,
  byR,
  code,
  ctx,
  dayShort,
  desk,
  els,
  esc,
  inQueue,
  laterOf,
  liveN,
  model,
  parseRef,
  plural,
  projOrder,
  projTitle,
  rcode,
  titleOf,
  useArea,
  when,
  whoName,
} from '../lib/state'
import { PSEC, PSEC_SIDE, PSEC_THIS } from '../lib/settings-data'
import { P_CACHE, loadLog } from '../lib/settings'
import { PUSH, noticeOn, noticeRead, noticeState, pushState, pushable, standalone } from '../lib/notices'
import { clean } from '../lib/markdown'
import { Armed, Avatar, Empty, Icon, Kbd, ProjTile, again } from './ui'
import { parkBox, placeBox } from './Composer'

const Part = ({
  title,
  about,
  children,
  id,
}: {
  title: ReactNode
  about?: ReactNode
  children?: ReactNode
  id?: string
}) => (
  <section
    {...(id ? { id } : {})}
    className="scroll-mt-16 border-t border-zinc-200 py-6 lg:scroll-mt-6 dark:border-zinc-800"
  >
    <h2 className="text-[15px] font-semibold">{title}</h2>
    {about ? <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{about}</p> : null}
    {children}
  </section>
)
const Setting = ({ title, about, control }: { title: ReactNode; about: ReactNode; control: ReactNode }) => (
  <section className="flex items-center gap-6 border-t border-zinc-200 py-6 dark:border-zinc-800">
    <div className="min-w-0 flex-1">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{about}</p>
    </div>
    {control}
  </section>
)
// T228 #6, #7: no word cut in two, no backticks shown
const Box = ({ t, mono = true }: { t: string; mono?: boolean }) => (
  <div
    className={`mt-3 rounded-xl bg-zinc-100 px-3.5 py-3 leading-relaxed text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 ${mono ? 'font-mono text-[13px] break-words' : 'text-sm break-words'}`}
  >
    {mono ? t : t.replace(/`/g, '')}
  </div>
)
const CopyBtn = ({ t, label, main = false }: { t: string; label: string; main?: boolean }) => (
  <button data-act="copy-text" data-text={t} className={`${main ? PRIMARY : SECOND} mt-3`}>
    <Icon n="copy" c={main ? 'size-4.5' : 'size-4'} />
    {label}
  </button>
)
const Ruled = ({ children }: { children: ReactNode }) => (
  <div className="border-t border-zinc-200 dark:border-zinc-800">{children}</div>
)
const Loading = () => (
  <Ruled>
    <p className="py-6 text-sm text-zinc-400">Loading…</p>
  </Ruled>
)
const Toggle = ({ act, on, label }: { act: string; on: boolean; label: string }) => (
  <button
    data-act={act}
    aria-pressed={on}
    aria-label={label}
    className="group relative h-6.5 w-11 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:inset-x-0 after:-inset-y-[9px] hover:brightness-95 aria-pressed:bg-emerald-500 dark:bg-zinc-600 dark:hover:brightness-125"
  >
    <span className="absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow transition-transform group-aria-pressed:translate-x-4.5" />
  </button>
)
export const agentAsk = () =>
  `This project tracks work in Taska. Run \`curl -s ${ctx.BASE}/agent\` to learn the interface, then follow \`curl -s ${ctx.BASE}/next\` and write your progress back to the items.`

// One change, as a sentence (B131): who, then what, with item codes and inputs as links; the time in grey.
export function logLine(l: string) {
  const m = /^#(\d+) (\S+ \S+) (\S+) (.*)$/s.exec(l)
  if (!m) return esc(l)
  const FLD = 'status|when|pri|type|archived|parent|title|body|next',
    cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
  const ST = STATUS as Record<string, string>,
    WH = WHEN as Record<string, string>
  const setPart = (f: string, a: string, b: string) =>
    f === 'status'
      ? `${ST[a] || a} → ${ST[b] || b}`
      : f === 'when'
        ? `${WH[a] || a} → ${WH[b] || b}`
        : f === 'archived'
          ? b === 'True'
            ? 'archived'
            : 'unarchived'
          : f === 'pri'
            ? `priority ${a} → ${b}`
            : f === 'type'
              ? `type ${cap(a)} → ${cap(b)}`
              : f === 'parent'
                ? /^\d+$/.test(b)
                  ? `moved under ${code(Number(b))}`
                  : /^\d+$/.test(a)
                    ? `taken out from under ${code(Number(a))}`
                    : 'parent changed'
                : f === 'title'
                  ? `renamed “${b}”`
                  : f === 'body'
                    ? 'description edited'
                    : 'next step edited'
  const plain = String(m[4])
    .replace(/\*\*|__|`/g, '')
    .replace(/\[src=[^\]]*\]/g, '')
    .replace(/(^|\s)- (?:\( \)|\[ \]) /g, '$1')
    .replace(/ ''$/, ' a voice note') // T228 #11, #12
  const SAYS: Record<string, string> = {
    say: 'said',
    ask: 'asked',
    block: 'is blocked:',
    propose: 'proposed',
    progress: 'progress:',
    decide: 'decided',
    withdraw: 'took back the question:',
  }
  const what = esc(plain)
    .replace(/^in (r\d+)(?: →([A-Z]\d+))? /, (_, r, c) => (c ? `wrote ${r} to ${c} ` : `wrote ${r} `))
    .replace(
      /^new ([A-Z]\d+) (\w+) (P\d) (now|later) (.*?)(?: ←(r\d+))?$/s,
      (_, c, t, p, w, title, r) =>
        `made ${c}, ${/^[aeiou]/.test(t) ? 'an' : 'a'} ${t} (${p}${w === 'later' ? ', later' : ''}): ${title}${r ? ` from ${r}` : ''}`,
    )
    .replace(new RegExp(`\\b(${FLD}) (.*?)→(.*?)(?=, (?:${FLD}) |$| \\(undo #)`, 'gs'), (_, f, a, b) =>
      setPart(f, a, b),
    )
    .replace(/ \(undo #(\d+)\)$/, ' (undoing #$1)')
    .replace(/^keep-going (ON|OFF)$/, (_, v: string) => `turned Keep going ${v.toLowerCase()}`)
    .replace(/^ack (.+)$/, (_, rs: string) => `saw ${rs.split(' ').join(', ')}`)
    .replace(/^doc (D\d+) on ([A-Z]\d+) /, 'wrote $1 on $2: ')
    .replace(/^(D\d+) comment /, 'commented on $1: ')
    .replace(/^(undo|redo) organizer changes for (r\d+)$/, (_, k, r) =>
      k === 'undo' ? `undid the filing of ${r}` : `put back the filing of ${r}`,
    )
    .replace(/^(r\d+) (edit|append): /, (_, r, k) => (k === 'edit' ? `edited ${r}: ` : `added details to ${r}: `))
    .replace(/^organizer (r\d+) retry$/, 'filed $1 again')
    .replace(/^organizer (r\d+) (ok|FAILED): /, (_, r, k) => (k === 'ok' ? `filed ${r}: ` : `could not file ${r}: `))
    .replace(
      /\b(say|ask|block|propose|progress|decide|withdraw) (?=&#39;|&#x27;|'|&quot;|")/g,
      (_, k: string) => `${SAYS[k]} `,
    ) // the quote is escaped by now
    .replace(/\b([A-Z]\d{1,5})\b/g, (c) => {
      const n = parseRef(c)
      return n && byN.has(n) && code(n) === c
        ? `<button data-act="goto" data-n="${n}" class="font-semibold text-blue-600 hover:underline dark:text-blue-400">${c}</button>`
        : c
    })
    .replace(/\b(r\d+)\b/g, (r) =>
      byR.has(r)
        ? `<button data-act="go-input" data-id="${r}" class="font-mono text-blue-600 hover:underline dark:text-blue-400">${rcode(r)}</button>`
        : rcode(r),
    )
  return `<span class="font-medium text-zinc-800 dark:text-zinc-100">${esc(whoName(m[3]))}</span> ${what} <span class="font-mono text-[11px] whitespace-nowrap text-zinc-400">${esc(m[2])}</span>`
}
function LogList({ lines }: { lines: string[] }) {
  return (
    <ol className="divide-y divide-zinc-100 text-[13px] leading-relaxed text-zinc-600 dark:divide-zinc-800 dark:text-zinc-300">
      {lines.map((l, i) => {
        const u = (model.S.undo || []).find((u) => l.startsWith(`#${u.seq} `)) // one of your changes that can still be put back (F80)
        return (
          <li key={i} className="flex items-start gap-2 py-1.5">
            <span className="min-w-0 flex-1 break-words" dangerouslySetInnerHTML={{ __html: clean(logLine(l)) }} />
            {u ? (
              <button
                data-act="revert"
                data-seq={u.seq}
                className="relative -my-1 shrink-0 rounded-md px-2 py-1 font-sans text-xs font-semibold text-blue-600 after:absolute after:-inset-x-1 after:-inset-y-2.5 hover:bg-blue-50 lg:after:hidden dark:text-blue-400 dark:hover:bg-blue-400/10"
              >
                <Armed k={'revert ' + u.seq} ask={again(' to undo')}>
                  Undo
                </Armed>
              </button>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
// How the agents are doing, in one coloured card, on top of Settings › Agents.
function AgentCard() {
  const S = model.S
  const [tone, , line] = agentState(S.agents, S.work)
  const queue = S.items.filter(inQueue),
    later = laterOf(queue) // S3
  const look = {
    bad: [
      'bg-red-50 dark:bg-red-400/10',
      'bg-red-500 ring-4 ring-red-500/20 dark:bg-red-400',
      'text-red-800 dark:text-red-200',
      'text-red-700/80 dark:text-red-300/80',
    ],
    ok: [
      'bg-emerald-50 dark:bg-emerald-400/10',
      'bg-emerald-500 ring-4 ring-emerald-500/20 dark:bg-emerald-400',
      'text-emerald-900 dark:text-emerald-100',
      'text-emerald-800/80 dark:text-emerald-300/80',
    ],
    idle: [
      'bg-zinc-100 dark:bg-zinc-800',
      'bg-zinc-400 ring-4 ring-zinc-400/20',
      'text-zinc-800 dark:text-zinc-100',
      'text-zinc-500 dark:text-zinc-400',
    ],
  }[tone]
  return (
    <div className={`flex gap-3 rounded-2xl p-4 ${look[0]}`}>
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${look[1]}`} />
      <div>
        <p className={`text-[15px] leading-snug font-semibold ${look[2]}`}>{line}</p>
        <p className={`mt-1 text-[13px] leading-snug ${look[3]}`}>
          {plural(queue.length, 'item')} in the queue{later ? ` (${later} later)` : ''}
        </p>
      </div>
    </div>
  )
}
function GoneRows() {
  const gone = model.S.gone || []
  if (!gone.length) return null
  return (
    <ul className="mb-6 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {gone.map((x) => {
        const label = x.kind === 'item' ? x.code : `D${x.d}`
        return (
          <li key={label} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">
                <span className="mr-1.5 font-mono text-[13px] font-bold">{label}</span>
                {x.title}
              </span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {x.kind === 'item'
                  ? `Item${x.more ? `, with ${plural(x.more, 'subitem')}` : ''}`
                  : `Document${x.on ? ` on ${x.on}` : ''}`}{' '}
                · deleted {when(x.at)}
              </span>
            </span>
            <button
              data-act="gone-restore"
              data-kind={x.kind}
              data-ref={x.code || ''}
              data-d={x.d || ''}
              data-label={label}
              className={P_BTN}
            >
              Restore
            </button>
          </li>
        )
      })}
    </ul>
  )
}
function PhonePush() {
  if (!pushable() || !standalone())
    return (
      <Part
        title={standalone() ? "This phone can't get notifications" : 'Add Taska to the Home Screen first'}
        about={
          standalone()
            ? 'Its browser has no push service.'
            : 'Add Taska to the Home Screen (how: Use on your phone), open it from there, and turn notifications on here.'
        }
      >
        {standalone() ? null : (
          <a href={`${ctx.P}phone`} data-act="psec" data-sec="phone" className={`${SECOND} mt-3`}>
            <Icon n="phone" c="size-4" />
            Use on your phone
          </a>
        )}
      </Part>
    ) // T228 #15
  if (PUSH.sub === undefined) {
    void pushState().then(() => bump('project'))
    return <Loading />
  }
  const blocked = Notification.permission === 'denied'
  return (
    <>
      <Setting
        title={blocked ? 'Blocked by the phone' : PUSH.sub ? 'On' : 'Off'}
        about="A notification when something needs you in any project, even with Taska closed."
        control={
          PUSH.sub ? (
            <button data-act="push-off" className={SECOND}>
              Turn off
            </button>
          ) : (
            <button data-act="push-on" disabled={blocked} className={PRIMARY}>
              Turn on
            </button>
          )
        }
      />
      {PUSH.sub ? (
        <Setting
          title="Quiet 22:00–08:00"
          about="Taska keeps them till the morning."
          control={<Toggle act="notifications-quiet" on={noticeRead('quiet', true)} label="Quiet 22:00–08:00" />}
        />
      ) : null}
    </>
  )
}
const BODY: Record<string, () => ReactNode> = {
  notifications: () =>
    !desk() ? (
      <PhonePush />
    ) : (
      <>
        <Setting
          title={noticeState()}
          about="For this browser."
          control={
            noticeOn() ? null : (
              <button
                data-act="notifications-on"
                disabled={noticeState() === 'Blocked by the browser'}
                className={PRIMARY}
              >
                Turn on
              </button>
            )
          }
        />
        {noticeOn() ? (
          <Setting
            title="Quiet 22:00–08:00"
            about="Your local time."
            control={<Toggle act="notifications-quiet" on={noticeRead('quiet', true)} label="Quiet 22:00–08:00" />}
          />
        ) : null}
      </>
    ),
  agents: () => {
    // T322 (design X): everything on one screen: who is here and what is queued, who has been here, and how to
    // connect one more (a command or a message), with one kind of copy button
    const S = model.S
    const cmd = `curl -s ${ctx.BASE}/connect | sh`,
      far = S.remote && S.remote !== ctx.BASE ? `curl -s ${S.remote}/connect | sh` : '',
      ask = agentAsk()
    const seen = [...(S.agents || [])].sort((a, b) => b.t - a.t)
    const CARD = 'rounded-2xl border border-zinc-200 dark:border-zinc-800'
    const way = (icon: string, title: string, copy: string, body: ReactNode) => (
      <section className={`${CARD} flex min-w-0 flex-col`}>
        <header className="flex h-12 items-center gap-2 border-b border-zinc-200 pr-2 pl-4 dark:border-zinc-800">
          <Icon n={icon} c="size-4 text-zinc-500 dark:text-zinc-400" />
          <h3 className="min-w-0 flex-1 text-sm font-semibold">{title}</h3>
          <button data-act="copy-text" data-text={copy} className={`${CHIP} font-medium`}>
            <Icon n="copy" c="size-3.5" />
            Copy
          </button>
        </header>
        <div className="flex flex-col gap-2.5 p-4 text-sm">{body}</div>
      </section>
    )
    return (
      <div className="flex flex-col gap-8 border-t border-zinc-200 py-6 dark:border-zinc-800">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <AgentCard />
          <section className={`${CARD} px-4 py-3`}>
            <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Seen in this project
            </h3>
            {seen.length ? (
              <ul className="mt-1">
                {seen.map((a) => (
                  <li
                    key={a.name}
                    className={`flex h-9 items-center gap-2.5 text-sm ${a.name in AGENT_NAME && a.name !== 'agent' ? '' : 'opacity-55'}`}
                  >
                    <Avatar by={a.name} />
                    <span className="min-w-0 flex-1 truncate">{AGENT_NAME[a.name] || a.name}</span>
                    <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                      {a.waiting ? 'waiting for work' : agoLong(a.t)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No agent yet. Connect one below.</p>
            )}
          </section>
        </div>
        <section id="pConnect" className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">Connect one more agent</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {way(
              'keyboard',
              'Run a command',
              cmd,
              <>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Once on each machine, in the project&apos;s folder. It installs the Taska skill for Claude Code, Codex
                  and Antigravity.
                </p>
                <code className="font-mono text-[13px] leading-relaxed break-words">{cmd}</code>
                {far ? (
                  <p className="text-zinc-500 dark:text-zinc-400">
                    From another network, with the key:{' '}
                    <button
                      data-act="copy-text"
                      data-text={far}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      copy that command
                    </button>
                  </p>
                ) : null}
              </>,
            )}
            {way(
              'comment',
              'Or tell the agent',
              ask,
              <>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Paste this into your coding agent, in the project&apos;s folder.
                </p>
                <p className="leading-relaxed break-words">{ask.replace(/`/g, '')}</p>
              </>,
            )}
          </div>
        </section>
        <details className={`${CARD} group px-4`}>
          <summary className="flex min-h-12 cursor-pointer items-center gap-1.5 text-sm font-semibold hover:text-zinc-600 dark:hover:text-zinc-300">
            <Icon n="right" c="size-4 text-zinc-400 transition-transform group-open:rotate-90" />
            What the agent reads
          </summary>
          <pre className="mb-4 overflow-x-auto rounded-xl bg-zinc-50 p-3.5 text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap lg:scrollbar-thin dark:bg-zinc-900">
            {P_CACHE.guide || 'Loading…'}
          </pre>
        </details>
      </div>
    )
  },
  log: () =>
    !P_CACHE.log ? (
      <Loading />
    ) : !P_CACHE.log.length ? (
      <Ruled>
        <Empty>Nothing has changed yet.</Empty>
      </Ruled>
    ) : (
      <>
        <Ruled>
          <div className="pt-2">
            <LogList lines={P_CACHE.log} />
          </div>
        </Ruled>
        {P_CACHE.log.length >= LOG_N ? (
          <p className="pt-4 text-[13px] text-zinc-400 dark:text-zinc-500">The latest {LOG_N} changes</p>
        ) : null}
      </>
    ),
  projects: () => {
    if (!P_CACHE.projects) return <Loading />
    const S = model.S
    const live = [...P_CACHE.projects].sort(projOrder),
      gone = P_CACHE.trash || []
    const add = U.pNew ? (
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            id="pNewName"
            className={`${FIELD} h-10 py-1.5 text-sm`}
            placeholder="Project name"
            aria-label="New project name"
            autoComplete="off"
            spellCheck={false}
            defaultValue={U.pNewText || ''}
          />
          <button
            data-act="p-create"
            className="h-10 shrink-0 rounded-xl bg-zinc-900 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create
          </button>
          <button
            data-act="p-new-cancel"
            aria-label="Cancel"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Icon n="x" c="size-4" />
          </button>
        </div>
        {U.pErr ? (
          <p className="px-1 text-xs text-red-600 dark:text-red-400">{U.pErr}</p>
        ) : (
          <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Kbd k="↵" /> create and open it · <Kbd k="Esc" /> cancel
          </p>
        )}
      </div>
    ) : (
      <>
        <button data-act="p-new" className={`${SECOND} shrink-0`}>
          <Icon n="plus" c="size-4" sw="2" />
          New project
        </button>
        <p className="min-w-0 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
          Any name: spaces, {'\u4e2d\u6587'}, emoji. Its address is made from the name once, e.g.{' '}
          <code className="font-mono">/p/home-budget</code>.
        </p>
      </>
    )
    return (
      <>
        <section className="flex items-center gap-4 border-t border-zinc-200 py-5 dark:border-zinc-800">{add}</section>
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {live.map((p) => {
            const cur = p.name === S.project,
              ren = U.renaming === p.name
            return (
              <li key={p.name} className="flex min-h-16 items-center gap-3 py-3">
                <ProjTile name={p.name} cls="size-8 rounded-lg text-sm" />
                <div className="min-w-0 flex-1">
                  {ren ? (
                    <>
                      <input
                        id="pRename"
                        data-slug={p.name}
                        className={`${FIELD} h-10 max-w-[22rem] py-1.5 text-[15px] font-medium`}
                        defaultValue={titleOf(p)}
                        aria-label={`New name for ${titleOf(p)}`}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <p className="mt-1.5 flex items-center gap-1 px-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <Kbd k="↵" />
                        <span>save ·</span>
                        <Kbd k="Esc" />
                        <span>
                          cancel · the address stays <code className="font-mono">/p/{p.name}</code>
                        </span>
                      </p>
                    </>
                  ) : (
                    <a href={`/p/${encodeURIComponent(p.name)}/`} className="block rounded-lg hover:opacity-80">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[15px] font-semibold">{titleOf(p)}</span>
                        {cur ? (
                          <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            This project
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        /p/{p.name} · {p.open} open{cur && S.file ? ` · ${S.file}` : ''}
                      </p>
                    </a>
                  )}
                </div>
                {ren ? null : (
                  <>
                    <button data-act="p-rename" data-slug={p.name} className={P_BTN}>
                      <Icon n="pencil" c="size-4" />
                      Rename
                    </button>
                    <button data-act="p-delete" data-slug={p.name} className={P_BTN}>
                      <Icon n="trash" c="size-4" />
                      Delete
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {gone.length ? (
          <section className="pt-8">
            <h2 className="text-[15px] font-semibold">Deleted projects</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              A deleted project leaves the sidebar and stops giving work to agents. Nothing in it is lost: Restore
              brings it back as it was.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {gone.map((d) => (
                <li key={d.name} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-900">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-400 text-sm leading-none font-bold text-white uppercase dark:bg-zinc-600"
                  >
                    {[...String(d.title || '?')][0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium break-words text-zinc-600 dark:text-zinc-300">{d.title}</p>
                    <p className="text-xs break-words text-zinc-500 dark:text-zinc-400">
                      Deleted {dayShort(d.t)} · {plural(d.items, 'item')} ·{' '}
                      <span className="font-mono">/p/{d.name}</span>
                    </p>
                  </div>
                  <button data-act="p-restore" data-slug={d.name} className={P_BTN}>
                    <Icon n="undo" c="size-4" sw="2" />
                    Restore
                  </button>
                  <button
                    data-act="p-purge"
                    data-slug={d.name}
                    className={`${P_BTN} hover:text-red-600 dark:hover:text-red-400`}
                  >
                    <Armed k={'purge ' + d.name} ask={again(": it can't be undone")}>
                      Delete forever
                    </Armed>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Delete forever asks for a second click. It is the only step that cannot be undone.
            </p>
          </section>
        ) : null}
      </>
    )
  },
  phone: () => {
    const S = model.S,
      link = S.remote ? S.remote + '/' : ''
    return (
      <>
        {link ? (
          <Part
            title="Link"
            about="Send this link to your phone and open it once. From then on Taska opens there just like here, from anywhere."
          >
            <Box t={link} />
            <CopyBtn t={link} label="Copy link" main />
          </Part>
        ) : (
          <Part
            title="Link"
            about={
              <>
                Taska has no public address yet (start it with{' '}
                <code className="font-mono whitespace-nowrap">--public</code>). On the same network your phone needs no
                key.
              </>
            }
          />
        )}
        <Part
          title="On the Home Screen"
          about="Open the link, then on iPhone tap Share and Add to Home Screen; on Android, the menu and Install app. Taska then opens full screen, like an app, and can record voice notes."
        />
        <Part
          title="Key"
          about={`${link ? 'Or type' : 'Type'} the key once on the device. Taska on the Home Screen needs it.`}
        >
          <div className="mt-3 flex items-center gap-4">
            <span className="font-mono text-2xl tracking-wider select-all">{S.key}</span>
            <button data-act="copy-text" data-text={S.key} className={SECOND}>
              <Icon n="copy" c="size-4" />
              Copy key
            </button>
          </div>
        </Part>
        <Setting
          title="New key"
          about="This computer and your local network never need the key. A new key signs out every other device."
          control={
            <button
              data-act="new-key"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-400/10"
            >
              <Armed k="new-key" ask={again(': other devices will need the new link')}>
                New key
              </Armed>
            </button>
          }
        />
      </>
    )
  },
  fixes: () => {
    if (!P_CACHE.fixes) return <Loading />
    const pr = P_CACHE.prefs
    return (
      <>
        {pr ? (
          <>
            <Part
              title={
                <>
                  Transcription preferences
                  {pr.default ? <span className="ml-2 text-[13px] font-normal text-zinc-400">default</span> : null}
                </>
              }
              about="How every project's voice notes are written down, in your own words. Transcription follows them after its own rules."
            >
              {U.prefsEdit ? (
                <div data-prefs-slot className="mt-3" />
              ) : (
                <>
                  <div className="mt-3 rounded-xl bg-zinc-100 px-3.5 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                    {pr.text || ''}
                  </div>
                  <button data-act="prefs-edit" className={`${SECOND} mt-3`}>
                    <Icon n="pencil" c="size-4" />
                    Edit
                  </button>
                </>
              )}
            </Part>
            <Setting
              title="Tidy voice notes"
              about={
                pr.tidy
                  ? 'On: fillers and repeats out, sentences joined, every detail kept. The words as said stay one tap away (Original words, on the voice note).'
                  : 'Off: voice notes are written down word for word.'
              }
              control={
                <button data-act="tidy-toggle" role="switch" aria-checked={!!pr.tidy} className={SECOND}>
                  {pr.tidy ? 'Turn off' : 'Turn on'}
                </button>
              }
            />
            <Part
              title="Spellings"
              about={
                P_CACHE.fixes.length
                  ? 'Words voice notes hear your way: ones you corrected, and ones you added here.'
                  : 'None yet. Add a word below, or select wrong words in a voice note and write the right ones.'
              }
            >
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  id="fixWord"
                  className={`${FIELD} h-10 py-1.5 text-sm`}
                  placeholder="A name or term to hear right, e.g. Needs you"
                  aria-label="A word to hear right"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  data-act="fix-add"
                  className="h-10 shrink-0 rounded-xl bg-zinc-900 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Add
                </button>
              </div>
            </Part>
          </>
        ) : null}
        {!P_CACHE.fixes.length ? (
          pr ? null : (
            <Ruled>
              <Empty>
                None yet. When a voice note gets words wrong, select them in the input and write the right ones: from
                then on every project writes them your way.
              </Empty>
            </Ruled>
          )
        ) : (
          <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {P_CACHE.fixes.map((c) => (
              <li key={(c.wrong || '') + c.right} className="flex min-h-13 items-center gap-3 py-1.5 text-[15px]">
                <span className="min-w-0 flex-1 break-words">
                  {c.wrong ? (
                    <>
                      <span className="text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500">
                        {c.wrong}
                      </span>
                      <span className="px-2 text-zinc-400 dark:text-zinc-500">→</span>
                    </>
                  ) : null}
                  <span className="font-medium">{c.right}</span>
                </span>
                <button
                  data-act="fix-remove"
                  data-wrong={c.wrong || ''}
                  data-right={c.right}
                  aria-label="Forget this spelling"
                  title="Forget this spelling"
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 lg:size-9 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <Icon n="x" c="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    )
  },
  docs: () => {
    const docs = model.S.docs || []
    if (!docs.length)
      return (
        <Ruled>
          <Empty>
            No documents yet.
            <br />
            Agents write them on items; an item&apos;s ⋯ makes one too.
          </Empty>
        </Ruled>
      )
    return (
      <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {[...docs]
          .sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')) || b.d - a.d)
          .map((d) => {
            const it = byN.get(liveN(d.n)),
              c = d.blocks.reduce((k, b) => k + b.comments.length, 0) + (d.whole?.length || 0)
            return (
              <li key={d.d}>
                <button
                  data-act="docs-go"
                  data-d={d.d}
                  className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <Icon n="file" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{d.title}</span>
                    <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono">D{d.d}</span>
                      {it ? ` · ${code(it.n)} ${it.title}` : ''}
                      {c ? ` · ${plural(c, 'comment')}` : ''}
                      {d.t ? ` · ${when(d.t)}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
      </ul>
    )
  },
  deleted: () => {
    const S = model.S
    return (
      <>
        <GoneRows />
        {(S.deleted || []).length ? (
          <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {S.deleted.map((x) => (
              <li key={x.id} className="flex items-start gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-mono">{rcode(x.id)}</span> · {when(x.t)} · deleted {when(x.at)}
                  </p>
                  <p className="mt-1 line-clamp-3 text-[15px] leading-snug break-words">
                    {x.text || (x.files ? plural(x.files, 'file') : '')}
                  </p>
                  {x.items.length ? (
                    <p className="mt-1.5 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
                      With{' '}
                      {x.items.map((i, k) => (
                        <span key={i.code}>
                          {k ? ' · ' : ''}
                          <span className={`font-mono text-xs font-bold ${TYPE_TEXT[i.type as 'task']}`}>
                            {i.code}
                          </span>{' '}
                          {i.title}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
                <button data-act="input-restore" data-id={x.id} className={`${SECOND} shrink-0`}>
                  <Icon n="undo" c="size-4" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        ) : (S.gone || []).length ? null : (
          <Ruled>
            <Empty>Nothing deleted. An input, an item or a document you delete comes here.</Empty>
          </Ruled>
        )}
      </>
    )
  },
  organizer: () => {
    const S = model.S
    return S.org?.on ? (
      <Part
        title="On"
        about={`Gemini (${S.org.model}) reads each input you send and turns it into items, or updates the ones that exist, in every project. What it does with an input shows under it in Inputs, with Undo.`}
      />
    ) : (
      <Part
        title="Off"
        about="Your coding agent files what you send: it reads new inputs first when it asks for work. To have them filed as soon as you send them, set GEMINI_API_KEY where Taska runs and restart it."
      />
    )
  },
}
const AGENT_TONE: Record<string, string> = {
  ok: 'bg-emerald-500',
  bad: 'bg-red-500',
  idle: 'bg-zinc-300 dark:bg-zinc-600',
}
// what a section's row in the list says on its right
const RIGHT: Record<string, () => string | number> = {
  notifications: () => (desk() ? noticeState().replace('Blocked by the browser', 'Blocked') : PUSH.sub ? 'On' : 'Off'), // T243 #2
  agents: () => agentState(model.S.agents, model.S.work)[1],
  projects: () => (P_CACHE.projects ? P_CACHE.projects.length : ''),
  fixes: () => P_CACHE.fixes?.length || '',
  organizer: () => (model.S.org?.on ? 'On' : 'Off'),
  deleted: () => (model.S.deleted || []).length || '',
}
const aboutOf = (sec: string) => {
  const a = PSEC[sec][3]
  return typeof a === 'function' ? a() : a
}
function DeskNav({ sec }: { sec: string }) {
  const S = model.S
  const row = (k: string) => {
    const [path, icon, label] = PSEC[k],
      on = k === sec
    return (
      <a
        key={k}
        href={`${ctx.P}${path}`}
        data-act="psec"
        data-sec={k}
        {...(on ? { 'aria-current': 'page' as const } : {})}
        className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 aria-[current=page]:bg-zinc-200/70 aria-[current=page]:font-semibold aria-[current=page]:text-zinc-900 data-pressed:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 dark:aria-[current=page]:bg-zinc-800 dark:aria-[current=page]:text-zinc-50"
      >
        <Icon n={icon} c="size-4 opacity-70" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="max-w-28 truncate text-xs font-normal text-zinc-400 tabular-nums dark:text-zinc-500">
          {S.project ? (RIGHT[k]?.() ?? '') : ''}
        </span>
      </a>
    )
  }
  const group = (t: string) => (
    <div className="px-3.5 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
      {t}
    </div>
  )
  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-2">
        <button
          data-act="project-back"
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Icon n="left" c="size-4" />
          Back to {D.compose ? 'New input' : TAB_NAME[U.tab]}
          <Kbd k="Esc" />
        </button>
      </div>
      {PSEC_SIDE.includes(sec) ? (
        <>
          <h1 className="px-4 pt-1 text-[19px] font-semibold tracking-tight">{projTitle()}</h1>
          <div className="mt-3 flex flex-col gap-0.5 px-2">{PSEC_SIDE.map(row)}</div>
        </>
      ) : (
        <>
          <h1 className="px-4 pt-1 text-[19px] font-semibold tracking-tight">Settings</h1>
          {group('This project')}
          <div className="flex items-center gap-2 px-3.5 pb-1.5">
            <ProjTile name={S.project || ctx.HERE} cls="size-5 rounded-md text-[11px]" />
            <span className="min-w-0 truncate text-sm font-semibold">{projTitle()}</span>
          </div>
          <div className="flex flex-col gap-0.5 px-2">{PSEC_THIS.map(row)}</div>
          {group('All projects')}
          <div className="flex flex-col gap-0.5 px-2">
            {Object.keys(PSEC)
              .filter((k) => !PSEC_THIS.includes(k) && !PSEC_SIDE.includes(k))
              .map(row)}
          </div>
        </>
      )}
      <button
        data-act="keys"
        className="mt-auto flex h-12 shrink-0 items-center gap-2 border-t border-zinc-200 px-4 text-[13px] text-zinc-500 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <Icon n="keyboard" c="size-4" />
        <span className="flex-1 text-left">Keyboard shortcuts</span>
        <Kbd k="?" />
      </button>
    </>
  )
}
const PH_GROUP =
  'mx-3 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white dark:divide-zinc-800 dark:bg-zinc-900'
const PhHead = ({ title }: { title: string }) => (
  <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 bg-zinc-100/90 px-1 backdrop-blur dark:bg-zinc-950/90">
    <button
      data-act="project-back"
      aria-label="Back"
      className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 dark:text-zinc-400"
    >
      <Icon n="left" c="size-6" />
    </button>
    <h1 className="min-w-0 truncate text-[17px] font-semibold">{title}</h1>
  </header>
)
const PhLabel = ({ children }: { children: ReactNode }) => (
  <div className="flex min-w-0 items-center gap-1.5 px-5 pt-6 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
    {children}
  </div>
)
const PhNote = ({ children }: { children: ReactNode }) => (
  <p className="px-5 pt-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400">{children}</p>
)
function PhoneIndex() {
  const S = model.S
  const row = (k: string) => {
    const [path, icon, label] = PSEC[k],
      [tone, agent] = agentState(S.agents, S.work)
    return (
      <a
        key={k}
        href={`${ctx.P}${path}`}
        data-act="psec"
        data-sec={k}
        className="flex min-h-12 items-center gap-3 px-3.5 py-2.5 text-[15px]"
      >
        <Icon n={icon} c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <span className="shrink-0">{label}</span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">
          {!S.project ? null : k === 'agents' ? (
            <>
              <span className={`size-2 shrink-0 rounded-full ${AGENT_TONE[tone]}`} />
              <span className="truncate">{agent}</span>
            </>
          ) : (
            <span className="truncate">{RIGHT[k]?.() ?? ''}</span>
          )}
        </span>
        <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
      </a>
    )
  }
  return (
    <>
      <PhHead title="Settings" />
      <PhLabel>
        <span className="shrink-0">This project ·</span>
        <ProjTile name={S.project || ctx.HERE} cls="size-4 rounded text-[9px]" />
        <span className="truncate font-semibold text-zinc-700 dark:text-zinc-200">{projTitle()}</span>
      </PhLabel>
      <div className={PH_GROUP}>{PSEC_THIS.map(row)}</div>
      <PhNote>Connecting an agent is in Agents. The agent pill on the list opens it too.</PhNote>
      <PhLabel>All projects</PhLabel>
      <div className={PH_GROUP}>
        {Object.keys(PSEC)
          .filter((k) => !PSEC_THIS.includes(k) && !PSEC_SIDE.includes(k))
          .map(row)}
      </div>
      <PhNote>Projects: new, rename, delete and restore.</PhNote>
    </>
  )
}
function PhoneProjects() {
  if (!P_CACHE.projects) return <p className="px-5 py-6 text-sm text-zinc-400">Loading…</p>
  const S = model.S
  const live = [...P_CACHE.projects].sort(projOrder),
    gone = P_CACHE.trash || []
  const pill =
    'flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-100 px-3.5 text-sm font-medium dark:bg-zinc-800'
  const more = (key: string, title: string) => (
    <button
      data-act="p-more"
      data-key={key}
      aria-label={`More for ${title}`}
      aria-expanded={U.pMenu === key}
      className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 aria-expanded:bg-zinc-100 aria-expanded:text-zinc-700 dark:text-zinc-500 dark:aria-expanded:bg-zinc-800 dark:aria-expanded:text-zinc-200"
    >
      <Icon n="more" c="size-5" />
    </button>
  )
  const two = (save: string, saveLabel: string, cancel: string, slug = '') => (
    <div className="mt-2 flex gap-2">
      <button
        data-act={save}
        {...(slug ? { 'data-slug': slug } : {})}
        className="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {saveLabel}
      </button>
      <button
        data-act={cancel}
        className="h-11 shrink-0 rounded-xl px-4 text-[15px] font-medium text-zinc-600 dark:text-zinc-300"
      >
        Cancel
      </button>
    </div>
  )
  return (
    <>
      <div className={`${PH_GROUP} mt-4`}>
        {U.pNew ? (
          <div className="px-3.5 py-3">
            <input
              id="pNewName"
              className={`${FIELD} h-11 py-2`}
              placeholder="Project name"
              aria-label="New project name"
              autoComplete="off"
              spellCheck={false}
              defaultValue={U.pNewText || ''}
            />
            {two('p-create', 'Create', 'p-new-cancel')}
            <p
              className={`mt-2 text-xs leading-snug ${U.pErr ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}
            >
              {U.pErr || 'Any name: spaces, \u4e2d\u6587, emoji. Its address is made from the name once.'}
            </p>
          </div>
        ) : (
          <button
            data-act="p-new"
            className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px] font-medium text-blue-600 dark:text-blue-400"
          >
            <Icon n="plus" c="size-5" />
            New project
          </button>
        )}
      </div>
      <PhLabel>Projects</PhLabel>
      <div className={PH_GROUP}>
        {live.map((p) => {
          const cur = p.name === S.project,
            t = titleOf(p)
          if (U.renaming === p.name)
            return (
              <div key={p.name} className="flex items-start gap-3 px-3.5 py-3">
                <ProjTile name={p.name} cls="mt-1.5 size-8 rounded-lg text-sm" />
                <div className="min-w-0 flex-1">
                  <input
                    id="pRename"
                    data-slug={p.name}
                    className={`${FIELD} h-11 py-2 font-medium`}
                    defaultValue={t}
                    aria-label={`New name for ${t}`}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {two('p-rename-save', 'Save', 'p-rename-cancel', p.name)}
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    The address stays <span className="font-mono">/p/{p.name}</span>
                  </p>
                </div>
              </div>
            )
          return (
            <div key={p.name}>
              <div className="flex min-h-14 items-center gap-3 py-2 pr-1.5 pl-3.5">
                <a href={`/p/${encodeURIComponent(p.name)}/`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ProjTile name={p.name} cls="size-8 rounded-lg text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
                      <span className="truncate">{t}</span>
                      {cur ? (
                        <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          This project
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono">/p/{p.name}</span> · {p.open} open
                    </span>
                  </span>
                </a>
                {more(p.name, t)}
              </div>
              {U.pMenu === p.name ? (
                <div className="flex gap-2 pr-3.5 pb-3 pl-[3.75rem]">
                  <button data-act="p-rename" data-slug={p.name} className={pill}>
                    <Icon n="pencil" c="size-4" />
                    Rename
                  </button>
                  <button data-act="p-delete" data-slug={p.name} className={`${pill} text-red-600 dark:text-red-400`}>
                    <Icon n="trash" c="size-4" />
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {gone.length ? (
        <>
          <PhLabel>Deleted</PhLabel>
          <div className={PH_GROUP}>
            {gone.map((d) => (
              <div key={d.name}>
                <div className="flex min-h-14 items-center gap-3 py-2 pr-1.5 pl-3.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-400 text-sm leading-none font-bold text-white uppercase dark:bg-zinc-600"
                  >
                    {[...String(d.title || '?')][0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium break-words text-zinc-500 dark:text-zinc-400">
                      {d.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-400 dark:text-zinc-500">
                      Deleted {dayShort(d.t)} · {plural(d.items, 'item')}
                    </span>
                  </span>
                  <button
                    data-act="p-restore"
                    data-slug={d.name}
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
                  >
                    <Icon n="undo" c="size-4" sw="2" />
                    Restore
                  </button>
                  {more('gone:' + d.name, d.title)}
                </div>
                {U.pMenu === 'gone:' + d.name ? (
                  <div className="flex pr-3.5 pb-3 pl-[3.75rem]">
                    <button data-act="p-purge" data-slug={d.name} className={`${pill} text-red-600 dark:text-red-400`}>
                      <Icon n="trash" c="size-4" />
                      <Armed k={'purge ' + d.name} ask={again(": it can't be undone")}>
                        Delete forever
                      </Armed>
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <PhNote>Nothing in a deleted project is lost. Delete forever is in its ⋯ and needs a second tap.</PhNote>
        </>
      ) : null}
    </>
  )
}
function PhoneSection({ sec }: { sec: string }) {
  const name = PSEC[sec][2]
  return (
    <>
      <PhHead title={name} />
      <p className="px-5 pt-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">{aboutOf(sec)}</p>
      {sec === 'projects' ? (
        <PhoneProjects />
      ) : (
        <div className="mx-3 mt-4 rounded-2xl bg-white px-4 dark:bg-zinc-900 [&>:first-child]:border-t-0 [&>:last-child]:border-b-0">
          {model.S.project ? BODY[sec]() : <Loading />}
        </div>
      )}
      <div className="h-10" />
    </>
  )
}
export function ProjectView({ hidden }: { hidden: boolean }) {
  useArea('project')
  const nav = useRef<HTMLElement>(null),
    body = useRef<HTMLDivElement>(null)
  const sec = D.section,
    S = model.S
  const wantLog = !!(D.page && sec === 'log' && S.project && P_CACHE.logRev !== S.rev)
  useEffect(() => {
    if (wantLog) loadLog() // the project changed, so did its log (T339: asked after drawing, not while drawing)
  })
  if (
    D.page &&
    U.renaming &&
    P_CACHE.projects &&
    sec === 'projects' &&
    !P_CACHE.projects.some((p) => p.name === U.renaming)
  )
    U.renaming = null // that project is gone
  useLayoutEffect(() => {
    els.projectNav = nav.current
    els.projectBody = body.current
    if (D.page) placeBox() // B265: the box goes to its section once the page is there
  })
  if (D.page && body.current?.contains(els.composer)) parkBox()
  const phone = !desk()
  return (
    <section
      id="projectView"
      hidden={hidden}
      aria-label="Settings"
      className="flex min-h-0 flex-1 flex-col bg-zinc-100 lg:col-span-2 lg:col-start-1 lg:row-span-5 lg:row-start-1 lg:flex-row lg:overflow-hidden lg:bg-transparent dark:bg-zinc-950 dark:lg:bg-transparent"
    >
      <nav
        id="projectNav"
        ref={nav}
        hidden={phone && !!sec}
        aria-label="Sections of Settings"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-10 lg:w-60 lg:flex-none lg:shrink-0 lg:scrollbar-thin lg:border-r lg:border-zinc-200 lg:pb-4 dark:lg:border-zinc-800"
      >
        {!D.page ? null : phone ? sec ? null : <PhoneIndex /> : sec ? <DeskNav sec={sec} /> : null}
      </nav>
      <div
        id="projectBody"
        ref={body}
        hidden={phone && !sec}
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain lg:scrollbar-gutter-both lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70 ${D.page && U.prefsEdit ? 'pb-64' : ''}`}
      >
        {!D.page || !sec ? null : phone ? (
          <PhoneSection sec={sec} />
        ) : (
          <div className="mx-auto w-full max-w-[46rem] px-8 pt-9 pb-16">
            <header className="pb-6">
              <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{PSEC[sec][2]}</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">{aboutOf(sec)}</p>
            </header>
            {S.project ? BODY[sec]() : <Loading />}
          </div>
        )}
      </div>
    </section>
  )
}
