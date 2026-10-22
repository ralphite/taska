// The project page's frame: the sidebar (or the rail, or the phone's drawer), the project's bar with its tabs, the
// F348: Archive is a view of the item list (in the row of views), not a tab of its own; its address stays
const SHOWN_TABS = TABS.filter((t) => t !== 'archive')
// F347: on the desktop what you said is the list under New input, not a tab (the phone keeps its Inputs tab)
const DESK_TABS = SHOWN_TABS.filter((t) => t !== 'inputs')
// list's head, the list, the item pane, Settings, the one input box at the foot, and what floats over them: the sheet,
// the picture viewer, the tooltip, the bar on selected text, the toast. Below 1024px it is the phone's page.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  FIELD,
  HIT,
  RULE_STATUS,
  STATUS,
  STATUS_FILTER,
  ARCH_FILTER,
  SORTS,
  TAB_NAME,
  TABS,
  WHEN,
  type Tab,
  AGENT_NAME,
} from '../lib/constants'
import {
  D,
  DR,
  OV,
  U,
  agentState,
  agoShort,
  bump,
  ctx,
  desk,
  els,
  filtered,
  model,
  needsYou,
  openCount,
  plural,
  projOrder,
  projTitle,
  reduceMotion,
  searchCount,
  SWIPE,
  statusIsView,
  searchWords,
  sideProjects,
  tabCount,
  tabNum,
  titleOf,
  useArea,
  useTick,
  visible,
  wide,
} from '../lib/state'
import { PSEC } from '../lib/settings-data'
import { FAILED, TOAST, hideToast } from '../lib/toast'
import { VW, viewerAct } from '../lib/viewer'
import { searchMode, openItem, closeDrawer } from '../lib/nav'
import { writeURL } from '../lib/url'
import { addFiles } from '../lib/outbox'
import { bindProjDrag } from '../lib/projdrag'
import { ACT } from '../lib/actions'
import { Icon, Kbd, ProjTile } from './ui'
import { ITEM_DRAG, List } from './List'
import { InputsView } from './Inputs'
import { DetailView } from './Detail'
import { ProjectView } from './Settings'
import { BoxHomeSlot, Composer, DraftCard, Feedback, VcBar } from './Composer'
import { ComposeHead, SaidLately } from './Inputs'
import { Dialog, FilterControls } from './Sheets'

// ---------------------------------------------------------------- the phone's drawer (F54)
export const drawerW = () => Math.min(innerWidth * 0.85, 320)
/** x: how far the page is pushed right. */
export function setDrawer(x: number, animate = true) {
  const app = document.getElementById('app'),
    shade = document.getElementById('drawerShade'),
    drawer = document.getElementById('drawer')
  if (!app || !shade || !drawer) return
  if (x > 0) drawer.hidden = false
  app.style.transition = animate && !reduceMotion() ? 'transform 220ms ease-out' : 'none'
  app.style.transform = x > 0 ? `translateX(${x}px)` : ''
  for (const c of ['rounded-l-3xl', 'overflow-hidden', 'shadow-2xl']) app.classList.toggle(c, x > 0)
  shade.hidden = x <= 0
  shade.style.left = x + 'px'
  if (x <= 0 && animate)
    setTimeout(() => {
      if (!DR.open && !app.style.transform) drawer.hidden = true
    }, 240)
}

// ---------------------------------------------------------------- the agent's pill (T58 #1)
const PILL: Record<string, [string, string]> = {
  ready: [
    'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25',
    'bg-emerald-500 ring-3 ring-emerald-500/25 dark:bg-emerald-400 dark:ring-emerald-400/25',
  ],
  recent: [
    'bg-zinc-100 text-zinc-700 ring-zinc-900/5 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5',
    'bg-emerald-500 dark:bg-emerald-400',
  ],
  idle: [
    'bg-zinc-100 text-zinc-600 ring-zinc-900/5 dark:bg-zinc-800/80 dark:text-zinc-400 dark:ring-white/5',
    'bg-zinc-300 dark:bg-zinc-600',
  ],
  bad: [
    'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25',
    'bg-red-500 dark:bg-red-400',
  ],
}
export function agentLine() {
  const S = model.S
  const [tone, label] = agentState(S.agents, S.work)
  const ready = tone === 'ok' && (S.agents || []).some((a) => a.waiting),
    kind = tone === 'ok' ? (ready ? 'ready' : 'recent') : tone
  const off = model.offline >= 2
  // F411, B429: pointing at it says, one line each and the latest first, which agent, which session (the title its
  // app shows) and when it was last here, and which one waits for work now
  const lines = (S.agents || [])
    .flatMap((a) =>
      (a.sessions?.length ? a.sessions : [{ name: a.session || '', t: a.t }]).map((x, i) => ({
        t: x.t,
        text: [AGENT_NAME[a.name] || a.name, x.name, agoShort(x.t), a.waiting && i === 0 ? 'waiting for work' : '']
          .filter(Boolean)
          .join(' · '),
      })),
    )
    .sort((a, b) => b.t - a.t)
  return {
    kind,
    label,
    // R369 (B429): not the line the pill shows already
    title: off
      ? undefined
      : lines
          .map((l) => l.text)
          .filter((l) => l !== label)
          .join('\n') || undefined,
    off,
  }
}
function Pill() {
  const { kind, label, off } = agentLine()
  return off ? (
    <span
      role="status"
      className="flex h-8 items-center gap-2 rounded-full bg-zinc-100 px-3 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-900/5 ring-inset dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5"
    >
      <Icon n="spinner" c="size-3.5 animate-spin" sw="2.25" />
      Offline, retrying…
    </span>
  ) : (
    <span
      className={`flex h-8 max-w-44 items-center gap-2 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset ${PILL[kind][0]}`}
    >
      <span className={`size-2 shrink-0 rounded-full ${PILL[kind][1]}`} />
      <span className="truncate">{label}</span>
    </span>
  )
}

// T424 step 3: the one place that shows changes that did not go in, until each is retried or let go
function FailedPill() {
  const n = FAILED.length
  if (!n) return null
  return (
    <button
      data-act="failed-open"
      aria-label={`${n} not saved`}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 text-[13px] font-semibold text-red-700 ring-1 ring-red-600/20 ring-inset hover:bg-red-100 lg:px-3 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25 dark:hover:bg-red-400/20"
    >
      <Icon n="alert" c="size-3.5" sw="2.25" />
      {n}
      <span className="hidden lg:inline">not saved</span>
    </button>
  )
}

// ---------------------------------------------------------------- the sidebar, the rail, the drawer
function SideList() {
  const S = model.S,
    phone = !desk()
  if (phone) {
    if (!DR.list) return <div className="px-3 py-3 text-sm text-zinc-400">Loading…</div>
    return (
      <>
        {[...DR.list].sort(projOrder).map((p) => {
          const cur = p.name === S.project
          return (
            <a
              key={p.name}
              href={`/p/${encodeURIComponent(p.name)}/`}
              data-slug={p.name}
              {...(cur ? { 'aria-current': 'page' as const } : {})}
              className="group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 select-none [-webkit-touch-callout:none] hover:bg-zinc-200/50 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-200 data-dragging:bg-zinc-200/70 data-dragging:ring-0 data-drop:bg-blue-100 data-drop:ring-2 data-drop:ring-blue-500 data-pressed:bg-zinc-200/70 dark:hover:bg-zinc-800/60 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:ring-blue-400/30 dark:data-dragging:bg-zinc-800/70 dark:data-drop:bg-blue-400/15 dark:data-drop:ring-blue-400 dark:data-pressed:bg-zinc-800 data-dragging:[&>*]:invisible"
            >
              <ProjTile name={p.name} cls="size-8 rounded-lg text-sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[17px] font-medium group-aria-[current=page]:font-semibold">
                    {titleOf(p)}
                  </span>
                  {p.needs ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
                      {p.needs} need you
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{p.open} open</span>
              </span>
            </a>
          )
        })}
      </>
    )
  }
  return (
    <>
      {sideProjects().map((p) => {
        const cur = p.name === (S.project || ctx.HERE)
        return (
          <a
            key={p.name}
            href={`/p/${encodeURIComponent(p.name)}/`}
            data-slug={p.name}
            {...(cur ? { 'aria-current': 'page' as const, 'data-act': 'new-input' } : {})}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 select-none [-webkit-touch-callout:none] hover:bg-zinc-200/60 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-200 aria-[current=page]:hover:bg-blue-100 data-dragging:bg-zinc-200/70 data-dragging:ring-0 data-drop:bg-blue-100 data-drop:ring-2 data-drop:ring-blue-500 data-pressed:bg-zinc-200/80 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:ring-blue-400/30 dark:aria-[current=page]:hover:bg-blue-400/20 dark:data-dragging:bg-zinc-800/70 dark:data-drop:bg-blue-400/15 dark:data-drop:ring-blue-400 data-dragging:[&>*]:invisible"
          >
            <ProjTile name={p.name} cls="size-6 rounded-md text-xs" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={`min-w-0 flex-1 truncate text-sm ${cur ? 'font-semibold' : 'font-medium'}`}>
                  {titleOf(p)}
                </span>
                {p.needs ? (
                  <span
                    title={`${plural(p.needs, 'item')} need you`}
                    className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-100 px-1 text-[11px] font-bold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200"
                  >
                    {p.needs}
                  </span>
                ) : null}
              </span>
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{p.open} open</span>
            </span>
          </a>
        )
      })}
    </>
  )
}
const SideLink = ({ sec, icon, label, phone }: { sec: string; icon: string; label: string; phone?: boolean }) =>
  phone ? (
    <a
      href={`${ctx.P}${PSEC[sec][0]}`}
      data-act="psec"
      data-sec={sec}
      className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]"
    >
      <Icon n={icon} c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1">{label}</span>
      <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
    </a>
  ) : (
    <a
      href={`${ctx.P}${PSEC[sec][0]}`}
      data-act="psec"
      data-sec={sec}
      {...(U.side === sec ? { 'aria-current': 'page' as const } : {})}
      className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 aria-[current=page]:bg-zinc-200/80 aria-[current=page]:font-medium aria-[current=page]:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-zinc-800 dark:aria-[current=page]:text-zinc-50"
    >
      <Icon n={icon} c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </a>
  )
// F451: the page's stories in every state, built with the page and served by Taska at /storybook/
const StoryLink = ({ phone }: { phone?: boolean }) =>
  phone ? (
    <a
      href="/storybook/"
      target="_blank"
      rel="noopener"
      className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]"
    >
      <Icon n="book" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1">Storybook</span>
      <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
    </a>
  ) : (
    <a
      href="/storybook/"
      target="_blank"
      rel="noopener"
      className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <Icon n="book" c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
      <span className="min-w-0 flex-1 truncate">Storybook</span>
    </a>
  )
// the phone's drawer ends in a card (B162): Undo while there is one (a phone has no Z), and Settings
function DrawerSettings() {
  const u = U.mine.at(-1),
    S = model.S
  return (
    <div
      id="drawerSettings"
      className="mx-2 mt-2 shrink-0 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white lg:hidden dark:divide-zinc-700/60 dark:bg-zinc-800"
    >
      {u ? (
        <button
          data-act="undo-mine"
          className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]"
        >
          <Icon n="undo" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
          <span className="min-w-0 flex-1 leading-snug">Undo: {u.label}</span>
        </button>
      ) : null}
      {S.project ? (
        <>
          <SideLink sec="docs" icon="file" label="Documents" phone />
          <SideLink sec="log" icon="history" label="Activity" phone />
          <SideLink sec="deleted" icon="trash" label="Deleted" phone />
        </>
      ) : null}
      <StoryLink phone />
      <button
        data-act="project"
        className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]"
      >
        <Icon n="gear" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <span className="min-w-0 flex-1">Settings</span>
        <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
      </button>
    </div>
  )
}
// the sidebar's foot: Settings and the keys (T274 #24: Undo is on the toast and Z)
function SideFoot() {
  const S = model.S
  return (
    <div
      id="sideFoot"
      className="hidden shrink-0 flex-col gap-0.5 border-t border-zinc-200 p-2 lg:flex dark:border-zinc-800"
    >
      {S.project ? (
        <>
          <SideLink sec="docs" icon="file" label="Documents" />
          <SideLink sec="log" icon="history" label="Activity" />
          <SideLink sec="deleted" icon="trash" label="Deleted" />
        </>
      ) : null}
      <StoryLink />
      <div className="flex items-center gap-0.5">
        <button
          data-act="project"
          className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Icon n="gear" c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
          <span className="min-w-0 flex-1 truncate">Settings</span>
          <Kbd k="G S" />
        </button>
        <button
          data-act="keys"
          title="Keyboard shortcuts · ?"
          aria-label="Keyboard shortcuts"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Icon n="keyboard" c="size-4" />
        </button>
      </div>
    </div>
  )
}
function Drawer({ hidden, over }: { hidden: boolean; over: boolean }) {
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => (list.current ? bindProjDrag(list.current) : undefined), [])
  useEffect(() => {
    // F397: an item dragged from the list onto another project moves there
    const box = list.current
    if (!box) return
    const target = (e: DragEvent) => {
      const a = (e.target as Element).closest?.<HTMLElement>('a[data-slug]')
      return a && ITEM_DRAG.n && a.dataset.slug !== model.S.project ? a : null
    }
    const mark = (a: HTMLElement | null) =>
      box.querySelectorAll<HTMLElement>('[data-drop]').forEach((x) => x !== a && x.removeAttribute('data-drop'))
    const over = (e: DragEvent) => {
      const a = target(e)
      mark(a)
      if (!a) return
      e.preventDefault()
      a.setAttribute('data-drop', '')
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    }
    const leave = (e: DragEvent) => {
      if (!box.contains(e.relatedTarget as Node)) mark(null)
    }
    const drop = (e: DragEvent) => {
      const a = target(e)
      mark(null)
      if (!a) return
      e.preventDefault()
      void ACT['item-move-to']({ n: String(ITEM_DRAG.n), to: a.dataset.slug as string })
    }
    const end = () => mark(null)
    box.addEventListener('dragover', over)
    box.addEventListener('dragleave', leave)
    box.addEventListener('drop', drop)
    document.addEventListener('dragend', end)
    return () => {
      box.removeEventListener('dragover', over)
      box.removeEventListener('dragleave', leave)
      box.removeEventListener('drop', drop)
      document.removeEventListener('dragend', end)
    }
  }, [])
  return (
    <nav
      id="drawer"
      hidden={hidden}
      aria-label="Projects"
      className={`fixed top-0 left-0 flex h-dvh w-80 max-w-[85vw] flex-col bg-zinc-100 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))] lg:z-40 lg:w-[var(--side-w,15rem)] lg:max-w-none lg:shrink-0 lg:border-r lg:border-zinc-200 lg:bg-zinc-50 lg:pb-0 2xl:w-[var(--side-w,16rem)] dark:bg-zinc-900 dark:lg:border-zinc-800 ${over ? 'lg:fixed lg:shadow-2xl' : 'lg:relative'}`}
    >
      <div
        data-grip="side"
        className="group/line absolute inset-y-0 right-0 z-10 hidden w-3 translate-x-1/2 cursor-col-resize lg:block"
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-blue-500 opacity-0 transition-opacity group-hover/line:opacity-100 group-hover/line:delay-150 group-data-drag/line:opacity-100" />
      </div>
      <div className="flex h-14 shrink-0 items-center gap-2 px-5 lg:pr-2 lg:pl-4">
        <a
          href="/"
          id="homeLink"
          title="All projects"
          className="-mx-1.5 flex h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-zinc-200/60 lg:h-9 dark:hover:bg-zinc-800"
        >
          <span id="drawerLogo" className="text-blue-600 dark:text-blue-400">
            <Icon n="logo" c="size-6" sw="2.25" />
          </span>
          <span className="text-xl font-semibold tracking-tight lg:text-[19px]">Taska</span>
        </a>
        <button
          data-act="side"
          id="sideBtn"
          title="Hide the sidebar · ["
          aria-label="Hide the sidebar"
          className="ml-auto hidden size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Icon n="panel" c="size-[18px]" />
        </button>
      </div>
      {/* F396: pointing at New input shows a mic at its end: a click opens New input recording */}
      <div className="group/ni relative mx-2.5 mb-3 hidden shrink-0 lg:block">
        <button
          data-act="new-input"
          id="newInputBtn"
          aria-pressed={D.compose && !D.page}
          className="flex h-9 w-full items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-50 aria-pressed:bg-blue-50 aria-pressed:text-blue-700 aria-pressed:ring-blue-500/40 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-700 dark:aria-pressed:bg-blue-400/10 dark:aria-pressed:text-blue-300 dark:aria-pressed:ring-blue-400/40"
        >
          <Icon n="newinput" c="size-4" />
          <span className="flex-1 text-left">New input</span>
          <span className="group-hover/ni:invisible">
            <Kbd k="C" />
          </span>
        </button>
        <button
          data-act="new-voice"
          title="New input by voice · ⇧V"
          aria-label="New input by voice"
          className="absolute inset-y-1 right-1 hidden w-9 place-items-center rounded-lg text-zinc-600 group-hover/ni:grid hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
        >
          <Icon n="mic" c="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 lg:scrollbar-thin lg:pb-3 lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70">
        <div className="px-3 pb-1.5 text-xs font-semibold text-zinc-500 lg:text-[11px] lg:tracking-wider lg:uppercase dark:text-zinc-400">
          Projects
        </div>
        <div id="drawerList" ref={list} className="flex flex-col gap-0.5">
          <SideList />
        </div>
        {U.npOpen ? (
          <div id="npRow" className="mt-1 px-1">
            <div className="flex items-center gap-1.5">
              <input
                id="npName"
                className={`${FIELD} h-10 py-1.5 text-sm`}
                placeholder="Project name"
                aria-label="New project name"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                data-act="np-create"
                className="h-10 shrink-0 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Create
              </button>
              <button
                data-act="np-cancel"
                aria-label="Cancel"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
              >
                <Icon n="x" c="size-4" />
              </button>
            </div>
            <p id="npErr" hidden={!U.npErr} className="px-2 pt-1 text-xs text-red-600 dark:text-red-400">
              {U.npErr}
            </p>
          </div>
        ) : (
          <button
            data-act="new-project"
            id="drawerNew"
            className="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 hover:bg-zinc-200/60 lg:h-9 lg:rounded-xl lg:text-sm dark:text-blue-400 dark:hover:bg-zinc-800"
          >
            <Icon n="plus" c="size-5" />
            New project
          </button>
        )}
      </div>
      <DrawerSettings />
      <SideFoot />
    </nav>
  )
}
function Rail({ hidden }: { hidden: boolean }) {
  const b = (act: string, inner: ReactNode, title: string, attrs: Record<string, string | boolean> = {}) => (
    <button
      data-act={act}
      {...attrs}
      title={title}
      aria-label={title.split(' · ')[0]}
      className="relative grid size-10 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 aria-pressed:bg-zinc-200/80 aria-pressed:text-zinc-900 aria-[current=page]:bg-zinc-200/80 aria-[current=page]:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-pressed:bg-zinc-700 dark:aria-pressed:text-zinc-50 dark:aria-[current=page]:bg-zinc-700 dark:aria-[current=page]:text-zinc-50"
    >
      {inner}
    </button>
  )
  const S = model.S
  return (
    <nav
      id="rail"
      hidden={hidden}
      aria-label="Projects"
      className="z-30 h-dvh w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-zinc-50 py-2 lg:flex dark:border-zinc-800 dark:bg-zinc-900"
    >
      {b(
        'side',
        <span className="text-blue-600 dark:text-blue-400">
          <Icon n="logo" c="size-6" sw="2.25" />
        </span>,
        'Show the sidebar · [',
      )}
      {b('new-input', <Icon n="newinput" c="size-5" />, 'New input · C', { 'aria-pressed': D.compose && !D.page })}
      <div className="my-1 h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
      <div className="-my-1 flex min-h-0 [scrollbar-width:none] flex-col items-center gap-1 overflow-y-auto p-1">
        {sideProjects().map((p) => {
          const cur = p.name === (S.project || ctx.HERE)
          return (
            <a
              key={p.name}
              href={`/p/${encodeURIComponent(p.name)}/`}
              data-slug={p.name}
              {...(cur ? { 'aria-current': 'page' as const, 'data-act': 'new-input' } : {})}
              title={titleOf(p)}
              aria-label={titleOf(p)}
              className="relative grid size-10 place-items-center rounded-xl hover:bg-zinc-200/60 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-300 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/20 dark:aria-[current=page]:ring-blue-400/40"
            >
              <ProjTile name={p.name} cls="size-7 rounded-lg text-xs" />
              {p.needs ? (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white dark:bg-amber-400 dark:text-amber-950">
                  {p.needs}
                </span>
              ) : null}
            </a>
          )
        })}
      </div>
      {b('new-project', <Icon n="plus" c="size-5" />, 'New project')}
      <div className="flex-1" />
      {b('project', <Icon n="gear" c="size-5" />, 'Settings · G S', D.page ? { 'aria-current': 'page' } : {})}
      {b('keys', <Icon n="keyboard" c="size-5" />, 'Keyboard shortcuts · ?')}
    </nav>
  )
}

// ---------------------------------------------------------------- the project's bar (desktop), the list's head
function keptCounts(): string[] | null {
  try {
    return JSON.parse(localStorage.getItem('taska.counts.' + ctx.HERE) || 'null')
  } catch {
    return null
  }
}
function tabNumber(t: Tab): string | number {
  const S = model.S
  if (!S.project) {
    // before the data (B190): the frame as it will be, with what this browser last saw
    const kept = keptCounts()
    return t === 'archive' ? '' : kept ? kept[TABS.indexOf(t)] : ''
  }
  return searchWords().length
    ? searchCount(t) || ''
    : t === 'archive'
      ? ''
      : t === 'items' && filtered() && U.tab === 'items'
        ? visible().filter((it) => !it.archived).length
        : tabCount(t)
}
function ProjBar({ hidden }: { hidden: boolean }) {
  const S = model.S
  const pre = !S.project && sideProjects()[0]
  const name = pre ? titleOf(pre) : projTitle()
  const { title } = agentLine()
  return (
    <nav
      id="projBar"
      hidden={hidden}
      aria-label="This project"
      className="h-12 min-w-0 items-stretch gap-1 border-b border-zinc-200 pr-3 pl-2 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:flex dark:border-zinc-800"
    >
      {U.renaming && U.renaming === S.project && !D.page ? (
        <div className="flex min-w-0 items-center gap-2 px-1">
          <ProjTile name={S.project} cls="size-6 rounded-md text-xs" />
          <input
            id="pRename"
            data-slug={S.project}
            className={`${FIELD} h-8 w-64 py-1 text-[15px] font-semibold`}
            defaultValue={projTitle()}
            aria-label={`New name for ${projTitle()}`}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
            <Kbd k="↵" /> save · <Kbd k="Esc" /> cancel
          </span>
        </div>
      ) : (
        // B356: the project's name, nothing to open: its settings, switching and the rest are in the sidebar and keys
        <div className="my-1.5 flex max-w-72 min-w-0 items-center gap-2 px-2">
          <ProjTile name={S.project || ctx.HERE} cls="size-6 rounded-md text-xs" />
          <span className="truncate text-[15px] font-semibold">{name}</span>
        </div>
      )}
      <span className="mx-2 my-3.5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />
      <div role="tablist" className="flex min-w-0 items-stretch gap-5">
        {DESK_TABS.map((t) => (
          <button
            key={t}
            data-act="tab"
            data-tab={t}
            role="tab"
            aria-selected={(U.tab === t || (t === 'items' && U.tab === 'archive')) && !D.page && !U.side}
            className="group -mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-0.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50"
          >
            {TAB_NAME[t]}
            <span className="font-mono text-[11px] font-medium text-zinc-400 tabular-nums">{tabNumber(t)}</span>
          </button>
        ))}
      </div>
      <div id="deskAgent" className="ml-auto flex shrink-0 items-center gap-2 pl-3">
        <FailedPill />
        {S.project ? (
          <button
            data-act="agent-info"
            title={title}
            className="flex rounded-full hover:brightness-95 dark:hover:brightness-125"
          >
            <Pill />
          </button>
        ) : null}
      </div>
    </nav>
  )
}
const filtersSet = (): [string, ReactNode][] =>
  (
    [
      U.type !== 'all' && U.tab !== 'rules'
        ? [
            'type',
            U.type[0].toUpperCase() + U.type.slice(1), // B358: the word alone
          ]
        : null,
      U.when !== 'all' ? ['when', WHEN[U.when as 'now']] : null,
      U.status !== 'all' && !statusIsView()
        ? [
            'status',
            U.tab === 'rules'
              ? (RULE_STATUS as Record<string, string>)[U.status] || (STATUS as Record<string, string>)[U.status]
              : STATUS_FILTER[U.status] || ARCH_FILTER[U.status] || (STATUS as Record<string, string>)[U.status],
          ]
        : null,
      U.pri !== 'all' ? ['pri', U.pri] : null,
      U.sort !== 'all' ? ['sort', SORTS.find(([v]) => v === U.sort)?.[1]] : null,
    ] as ([string, ReactNode] | null)[]
  ).filter(Boolean) as [string, ReactNode][]
const FilterChips = ({ set }: { set: [string, ReactNode][] }) => (
  <>
    {set.map(([k, label]) => (
      <button
        key={k}
        data-act="unfilter"
        data-k={k}
        className={`${HIT} flex h-8 shrink-0 items-center gap-1 rounded-full bg-blue-50 pr-2 pl-3 text-[13px] font-medium text-blue-800 ring-1 ring-blue-200 ring-inset hover:bg-blue-100 lg:h-7 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/25 dark:hover:bg-blue-400/20`}
      >
        {label}
        <Icon n="x" c="size-3.5" sw="2.25" />
      </button>
    ))}
  </>
)
const FilterDot = () =>
  filtersSet().length ? (
    <span className="absolute top-2 right-2 size-2 rounded-full bg-blue-600 ring-2 ring-white dark:bg-blue-400 dark:ring-zinc-950" />
  ) : null
function MainHead({ hidden }: { hidden: boolean }) {
  const S = model.S
  const sq = desk() || !!(U.searching || U.q)
  const { title } = agentLine()
  const qRef = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    els.q = qRef.current
    if (qRef.current && qRef.current.value !== U.q && document.activeElement !== qRef.current) qRef.current.value = U.q
  })
  const inputs = U.tab === 'inputs'
  return (
    <header
      id="mainHead"
      hidden={hidden}
      className="flex h-14 shrink-0 items-center gap-1 px-2 lg:col-start-1 lg:row-start-2 lg:gap-2 lg:border-r lg:border-b lg:border-zinc-200 lg:px-3 dark:lg:border-zinc-800"
    >
      <div id="headNormal" hidden={sq} className="contents">
        <button
          id="projBtn"
          data-act="projects"
          aria-label="Projects and settings"
          className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-800"
        >
          <span className="relative text-zinc-700 dark:text-zinc-300">
            <span id="logo">
              <Icon n="menu" c="size-6" />
            </span>
            <span
              id="otherDot"
              hidden={!(DR.list || []).some((p) => p.name !== S.project && p.needs)}
              title="Another project needs you"
              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:bg-amber-400 dark:ring-zinc-950"
            />
          </span>
          <span id="projName" className="truncate text-[19px] font-semibold tracking-tight">
            {S.project ? projTitle() : decodeURIComponent(ctx.HERE || 'Taska')}
          </span>
        </button>
        <FailedPill />
        <button
          id="agentBtn"
          data-act="agent-info"
          aria-label="Agents"
          title={title}
          className="flex h-11 shrink-0 items-center px-1"
        >
          {S.project ? <Pill /> : null}
        </button>
        <button
          id="searchBtn"
          data-act="search"
          aria-label="Search"
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 data-pressed:bg-zinc-100 dark:text-zinc-400 dark:data-pressed:bg-zinc-800"
        >
          <Icon n="search" c="size-5.5" />
        </button>
      </div>
      <div id="headSearch" hidden={!sq} className="contents">
        <label
          className={`ml-1 flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-zinc-100 pl-3 text-zinc-400 lg:ml-0 lg:h-9 lg:ring-blue-500/40 lg:focus-within:bg-white lg:focus-within:ring-2 dark:bg-zinc-800 dark:text-zinc-500 dark:lg:focus-within:bg-zinc-900 ${desk() && inputs ? 'lg:ml-auto lg:max-w-sm' : ''}`}
        >
          <span id="searchIcon">
            <Icon n="search" c="size-4.5" />
          </span>
          <input
            id="q"
            ref={qRef}
            type="search"
            autoComplete="off"
            placeholder={
              !desk()
                ? 'Search title, text or code'
                : inputs
                  ? 'Search what you said'
                  : U.tab === 'rules'
                    ? 'Search rules'
                    : 'Search items'
            }
            defaultValue={U.q}
            className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 lg:text-sm dark:text-zinc-100 [&::-webkit-search-cancel-button]:hidden"
            onInput={(e) => onSearch((e.target as HTMLInputElement).value)}
            onFocus={() => {
              if (!desk() && !U.searching) searchModeOn()
            }} // B152
            onKeyDown={(e) => {
              // B130: from the search, Down or Enter goes to the first result
              if (!desk() || !(e.key === 'ArrowDown' || (e.key === 'Enter' && !e.nativeEvent.isComposing))) return
              const first =
                U.tab === 'inputs' ? null : document.querySelector<HTMLElement>('#list [data-act="open"][data-n]')
              e.preventDefault()
              qRef.current?.blur()
              if (first) openFirst(Number(first.dataset.n))
            }}
          />
          <kbd
            id="qKey"
            className={`mr-2 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600 ${U.q ? '' : 'lg:grid'}`}
          >
            /
          </kbd>
          <button
            id="qX"
            data-act="search-clear"
            aria-label="Clear search"
            className={`group -mr-1 grid size-11 shrink-0 place-items-center rounded-full lg:size-9 ${U.q ? '' : 'lg:hidden'}`}
          >
            <span
              id="qClear"
              className="grid size-5 place-items-center rounded-full bg-zinc-400 text-white group-hover:bg-zinc-500 dark:bg-zinc-600 dark:text-zinc-900 dark:group-hover:bg-zinc-500"
            >
              <Icon n="x" c="size-3" sw="3" />
            </span>
          </button>
        </label>
        <button
          data-act="search-cancel"
          className="h-11 shrink-0 px-2.5 text-[15px] font-medium text-blue-600 lg:hidden dark:text-blue-400"
        >
          Cancel
        </button>
      </div>
      <button
        id="deskFilterBtn"
        data-act="filters"
        title="Filter · F"
        aria-label="Filters"
        aria-expanded={!!D.filters}
        hidden={inputs}
        className="relative hidden size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 aria-expanded:bg-zinc-100 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800"
      >
        <Icon n="sliders" c="size-[18px]" />
        <FilterDot />
      </button>
    </header>
  )
}
const searchModeOn = () => searchMode(true)
const openFirst = (n: number) => openItem(n)
function onSearch(v: string) {
  U.q = v
  writeURL(false)
  bump('list', 'inputs', 'head', 'detail')
  if (U.tab !== 'inputs' && els.list) els.list.scrollTop = 0
}
// From 360 px the four tabs fit with their counts; narrower, only the open tab keeps its count (T225 #12, B158).
const COUNTS_KEPT: Record<string, string> = {}
function Tabs({ hidden }: { hidden: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const S = model.S,
    words = searchWords().length,
    pending = S.inputs.filter((r) => !r.acked).length
  const kept = !S.project ? keptCounts() : null
  const counts: Record<Tab, string | number> = kept
    ? { items: kept[0] ?? '', inputs: kept[1] ?? '', archive: kept[2] ?? '', rules: kept[3] ?? '' }
    : {
        items: tabNum(
          words
            ? searchCount('items')
            : U.tab === 'items' && filtered()
              ? visible().filter((it) => !it.archived).length
              : openCount(),
        ),
        inputs: tabNum(words ? searchCount('inputs') : pending),
        archive: tabNum(words ? searchCount('archive') : S.items.filter((it) => it.archived && !it.merged_into).length),
        rules: tabNum(
          words
            ? searchCount('rules')
            : S.items.filter((it) => it.type === 'rule' && !it.merged_into && !it.archived && it.status !== 'dropped')
                .length,
        ),
      }
  useLayoutEffect(() => {
    const list = ref.current
    if (!list || desk()) return
    const spans = [...list.querySelectorAll<HTMLElement>('[data-count]')]
    for (const c of spans) c.hidden = false
    if (list.scrollWidth > list.clientWidth + 1) for (const c of spans) c.hidden = !c.closest('[aria-selected="true"]')
    const keep = JSON.stringify(TABS.map((t) => String(counts[t])))
    if (S.project && !filtered() && COUNTS_KEPT[S.project] !== keep)
      try {
        localStorage.setItem('taska.counts.' + S.project, keep) // for the next page's first paint (B190)
        COUNTS_KEPT[S.project] = keep // T339: written when they change, not on every redraw
      } catch {
        /* no storage */
      }
  })
  return (
    <nav
      id="tabs"
      hidden={hidden}
      className="flex h-11 shrink-0 items-stretch border-b border-zinc-200 pr-1 pl-4 lg:hidden dark:border-zinc-800"
    >
      <div
        ref={ref}
        role="tablist"
        className="flex min-w-0 [scrollbar-width:none] items-stretch gap-2 overflow-x-auto min-[400px]:gap-4"
      >
        {SHOWN_TABS.map((t) => (
          <button
            key={t}
            data-act="tab"
            data-tab={t}
            role="tab"
            aria-selected={U.tab === t || (t === 'items' && U.tab === 'archive')}
            className="group -mb-px flex h-11 shrink-0 items-center gap-0.5 border-b-2 border-transparent text-[14px] font-medium text-zinc-500 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 min-[400px]:gap-1 min-[400px]:text-[15px] dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50"
          >
            {TAB_NAME[t]}
            <span
              data-count
              title={t === 'inputs' && !words && pending ? `${pending} pending` : undefined}
              className="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums group-aria-selected:bg-zinc-900/7 group-aria-selected:text-zinc-600 group-aria-[selected=false]:px-0.5 empty:hidden min-[400px]:group-aria-[selected=false]:px-1 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"
            >
              {counts[t]}
            </span>
          </button>
        ))}
      </div>
      <button
        id="filterBtn"
        data-act="filters"
        aria-label="Filters"
        hidden={U.tab === 'inputs'}
        className="relative ml-auto grid size-11 shrink-0 place-items-center text-zinc-500 dark:text-zinc-400"
      >
        <Icon n="sliders" c="size-5" />
        <FilterDot />
      </button>
    </nav>
  )
}
function FilterStrip() {
  const set = filtersSet()
  return (
    <div
      id="filterStrip"
      hidden={!set.length || U.tab === 'inputs' || !!U.open || !!D.page}
      className="flex h-11 shrink-0 [scrollbar-width:none] items-center gap-2 overflow-x-auto border-b border-zinc-100 px-4 lg:hidden dark:border-zinc-800/70"
    >
      <FilterChips set={set} />
      <button
        data-act="reset"
        className="ml-auto h-11 shrink-0 px-1 text-[13px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        Clear
      </button>
    </div>
  )
}
// On the desktop the same controls open in place under the list header instead of a sheet.
function DeskFilters({ hidden }: { hidden: boolean }) {
  const set = filtersSet()
  return (
    <div
      id="deskFilters"
      hidden={hidden}
      className="border-zinc-200 lg:col-start-1 lg:row-start-3 lg:border-r lg:border-b dark:border-zinc-800"
    >
      {!desk() || (!set.length && !D.filters) ? null : (
        <>
          <div className="flex min-h-11 flex-wrap items-center gap-2 px-3 py-1.5">
            <FilterChips set={set} />
            {set.length ? (
              <button
                data-act="reset"
                className="ml-auto h-8 px-1 text-[13px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Clear
              </button>
            ) : (
              <span className="ml-auto" />
            )}
            <button
              data-act="filters"
              aria-label={D.filters ? 'Fold the filters' : 'Show the filters'}
              className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Icon n={D.filters ? 'chevup' : 'down'} c="size-4" sw="2" />
            </button>
          </div>
          {D.filters ? (
            <div className="flex flex-col gap-3 px-3 pb-3">
              <FilterControls small />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- the foot: the box, and the New input page (B73)
function Foot({ hidden, wideCls }: { hidden: boolean; wideCls: string }) {
  const compose = desk() && D.compose && !D.page && U.tab !== 'inputs'
  // F478: what scrolls above the box runs on under it, around its rounded corners; the room it needs is the foot's.
  // Only around its top: from the box's middle down the foot is the page's own white, so nothing shows under the box.
  useLayoutEffect(() => {
    const foot = document.getElementById('foot')
    if (!foot || typeof ResizeObserver === 'undefined') return
    const set = () => {
      const f = foot.getBoundingClientRect(),
        box = foot.querySelector('#composer')?.getBoundingClientRect()
      document.documentElement.style.setProperty('--foot-h', (foot.hidden ? 0 : foot.offsetHeight) + 'px')
      foot.style.setProperty('--foot-cut', (box ? box.top - f.top + box.height / 2 : f.height) + 'px')
    }
    const ro = new ResizeObserver(set)
    ro.observe(foot)
    set()
    return () => ro.disconnect()
  }, [hidden, compose])
  return (
    <footer
      id="foot"
      hidden={hidden}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files])
      }}
      className={`relative z-20 shrink-0 px-3 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] after:pointer-events-none after:absolute after:inset-x-0 after:top-(--foot-cut) after:bottom-0 after:-z-10 after:bg-white lg:group-data-[compose]/app:after:hidden dark:after:bg-zinc-950 lg:row-start-5 lg:scrollbar-gutter-both lg:px-8 lg:pb-5 lg:group-data-duo/app:pl-[calc(var(--duo-w,55%)+2rem)] lg:group-data-[compose]/app:row-span-3 lg:group-data-[compose]/app:row-start-3 lg:group-data-[compose]/app:overflow-y-auto lg:group-data-[compose]/app:overscroll-contain lg:group-data-[compose]/app:pt-[5vh] lg:group-data-[compose]/app:pb-16 lg:group-data-duo/app:before:absolute lg:group-data-duo/app:before:inset-y-0 lg:group-data-duo/app:before:left-[var(--duo-w,55%)] lg:group-data-duo/app:before:w-px lg:group-data-duo/app:before:bg-zinc-200 lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:group-data-duo/app:before:bg-zinc-800 dark:lg:hover:scrollbar-thumb-zinc-400/70 ${wideCls}`}
    >
      {compose && ComposeHead() ? (
        <div
          id="composeHead"
          className="hidden lg:group-data-[compose]/app:mx-auto lg:group-data-[compose]/app:mb-6 lg:group-data-[compose]/app:flex lg:group-data-[compose]/app:max-w-[42rem] lg:group-data-[compose]/app:flex-col lg:group-data-[compose]/app:items-center lg:group-data-[compose]/app:text-center"
        >
          {ComposeHead()}
        </div>
      ) : null}
      <Feedback />
      <BoxHomeSlot />
      <section
        id="composeList"
        aria-label="You said lately"
        className="hidden lg:group-data-[compose]/app:mx-auto lg:group-data-[compose]/app:mt-8 lg:group-data-[compose]/app:block lg:group-data-[compose]/app:max-w-[42rem]"
      >
        {compose ? <SaidLately draft={<DraftCard />} /> : null}
      </section>
    </footer>
  )
}

// ---------------------------------------------------------------- what floats over the page
function Toast() {
  useArea('toast')
  useArea('dialog')
  const ref = useRef<HTMLDivElement>(null)
  const t = TOAST
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !t.shown) return
    // On the phone it moves when a sheet opens or closes under it, so it never sits on the sheet's buttons
    const up = (!!OV.spec && !desk()) || !!D.page // T228 #3, #5, #17
    el.classList.toggle('bottom-28', !up)
    el.classList.toggle('top-[calc(env(safe-area-inset-top)+0.75rem)]', up)
    el.classList.toggle('lg:bottom-auto', up)
    el.classList.toggle('lg:top-32', !!D.page && desk()) // T243 #3
    if (desk()) {
      // B129: on the desktop it shows in the pane you acted in, above the box if the box is there
      const pane = [
          LAST.pane?.id === 'drawer' ? null : LAST.pane,
          document.getElementById('detailView'),
          els.inputsView,
          els.projectBody,
        ].find((p) => p?.isConnected && p.offsetParent),
        r = pane?.getBoundingClientRect()
      const f = document.getElementById('foot')?.getBoundingClientRect(),
        above = r && f && f.height < 300 && f.left < r.right && f.right > r.left
      if (r) {
        el.style.left = `${r.left + r.width / 2}px`
        el.style.bottom = up ? '' : `${above && f ? innerHeight - f.top + 12 : 20}px`
      }
      el.classList.toggle('lg:-translate-x-1/2', !!r)
    } else {
      // B158: on the phone it sits just above what you act on, the input box or an open card's bar, and never on it
      el.style.left = el.style.bottom = ''
      el.classList.remove('lg:-translate-x-1/2')
      const foot = document.getElementById('foot'),
        dlgFoot = document.getElementById('dlgFoot')
      const bar = DR.open
        ? document.getElementById('drawerSettings')
        : !OV.spec
          ? foot && !foot.hidden && foot
          : document.getElementById('overlay')?.dataset.card
            ? null
            : dlgFoot && !dlgFoot.hidden && dlgFoot.offsetHeight && dlgFoot
      if (bar) {
        el.style.bottom = `${Math.round(innerHeight - bar.getBoundingClientRect().top + 8)}px`
        el.classList.remove('bottom-28', 'top-[calc(env(safe-area-inset-top)+0.75rem)]')
      }
    }
  })
  return (
    <div
      id="toast"
      ref={ref}
      hidden={!t.shown}
      role={t.error ? 'alert' : 'status'}
      {...(t.error ? { 'data-error': '' } : {})}
      className={`fixed inset-x-0 bottom-28 z-[60] mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-zinc-900 py-2 pr-4 pl-4 text-sm text-white shadow-lg has-[button]:py-1.5 has-[button]:pr-1.5 data-error:bg-red-600 data-error:text-white lg:right-auto lg:bottom-5 lg:left-5 lg:mx-0 lg:max-w-md dark:bg-zinc-100 dark:text-zinc-900 dark:data-error:bg-red-600 dark:data-error:text-white ${t.act || t.sticky ? '' : 'pointer-events-none'}`}
    >
      {t.error ? <Icon n="alert" c="size-4" sw="2" /> : null}
      <span className="line-clamp-2 min-w-0 leading-snug">{t.text}</span>
      {t.act ? (
        <button
          data-toast
          onClick={(e) => {
            e.stopPropagation()
            const a = t.act
            t.shown = false
            bump('toast')
            void a?.()
          }}
          className={`relative h-8 shrink-0 rounded-full px-3 text-sm font-semibold after:absolute after:-inset-1.5 ${t.error ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/15 text-white hover:bg-white/25 dark:bg-zinc-900/10 dark:text-zinc-900 dark:hover:bg-zinc-900/20'}`}
        >
          {t.label}
        </button>
      ) : null}
      {t.sticky ? (
        <button
          data-toast
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation()
            hideToast()
          }}
          className="relative grid size-8 shrink-0 place-items-center rounded-full text-white/80 after:absolute after:-inset-1.5 hover:bg-white/20 hover:text-white"
        >
          <Icon n="x" c="size-4" />
        </button>
      ) : null}
    </div>
  )
}
/** The pane you acted in last: the toast shows there (B129). */
export const LAST = { pane: null as HTMLElement | null }
// Closing and moving like a photo app (B140): a tap on the dark area closes; on a phone, at fit size, a sideways swipe
// goes to the next or previous picture and a swipe down closes; two fingers zoom the picture, never the page (B302).
const VS = { x: 0, y: 0, on: false, d0: 0, d1: 0 }
function Viewer() {
  useArea('viewer')
  const f = VW.group[VW.idx] || '',
    url = `${ctx.P}f/${encodeURIComponent(f)}`
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const v = ref.current
    if (!v) return
    const move = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      VS.d0 ||= dist(e.touches)
      VS.d1 = dist(e.touches)
    }
    const gest = (e: Event) => e.preventDefault() // Safari's own pinch
    v.addEventListener('touchmove', move, { passive: false })
    v.addEventListener('gesturestart', gest)
    return () => {
      v.removeEventListener('touchmove', move)
      v.removeEventListener('gesturestart', gest)
    }
  }, [])
  return (
    <div
      id="viewer"
      ref={ref}
      hidden={!VW.open}
      className="fixed inset-0 z-50 flex flex-col bg-black pt-[env(safe-area-inset-top)] text-white"
      onTouchEnd={(e) => {
        if (!VS.d0 || e.touches.length) return
        const r = VS.d1 / VS.d0
        VS.d0 = VS.d1 = 0
        if (VW.fit ? r > 1.2 : r < 0.83) viewerAct('zoom')
      }}
    >
      <header className="flex items-center gap-2 px-2 py-1 text-sm">
        <span id="vName" className="min-w-0 flex-1 truncate pl-2">
          {f.replace(/^f\d+-/, '')}
        </span>
        <span id="vIdx" className="text-white/60">
          {VW.group.length > 1 ? `${VW.idx + 1} / ${VW.group.length}` : ''}
        </span>
        <a
          id="vOpen"
          href={f ? url : undefined}
          target="_blank"
          rel="noopener"
          className="flex h-11 items-center rounded-full px-3 text-white/80 hover:bg-white/10"
        >
          Open file
        </a>
        <button
          data-act="v-close"
          aria-label="Close"
          className="grid size-11 place-items-center rounded-full hover:bg-white/10"
          id="vClose"
        >
          <Icon n="x" />
        </button>
      </header>
      <div
        id="vStage"
        className="flex min-h-0 flex-1 overflow-auto lg:scrollbar-thumb-white/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) viewerAct('close')
        }}
        onTouchStart={(e) => {
          VS.on = e.touches.length === 1 && VW.fit
          if (VS.on) {
            VS.x = e.touches[0].clientX
            VS.y = e.touches[0].clientY
          }
        }}
        onTouchEnd={(e) => {
          if (!VS.on) return
          VS.on = false
          const t = e.changedTouches[0],
            dx = t.clientX - VS.x,
            dy = t.clientY - VS.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) viewerAct(dx < 0 ? 'next' : 'prev')
          else if (dy > 80 && dy > 1.5 * Math.abs(dx)) viewerAct('close')
        }}
      >
        {VW.open && f ? (
          <img
            id="vImg"
            key={f}
            src={url}
            alt=""
            className={VW.fit ? 'm-auto max-h-full max-w-full object-contain' : 'm-auto max-w-none'}
          />
        ) : null}
      </div>
      <footer className="flex items-center justify-center gap-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-sm">
        <button data-act="v-prev" disabled={VW.idx === 0} className="h-11 rounded-full px-4 hover:bg-white/10">
          Previous
        </button>
        <button data-act="v-zoom" id="vZoom" className="h-11 rounded-full bg-white/10 px-4 hover:bg-white/20">
          {VW.fit ? 'Zoom to 100%' : 'Fit to screen'}
        </button>
        <button
          data-act="v-next"
          disabled={VW.idx >= VW.group.length - 1}
          className="h-11 rounded-full px-4 hover:bg-white/10"
        >
          Next
        </button>
      </footer>
    </div>
  )
}
// One tooltip for the whole page (T094); lib/tip.ts shows and places it.
const Tip = () => (
  <div
    id="tip"
    role="tooltip"
    hidden
    className="pointer-events-auto fixed top-0 left-0 z-[80] max-w-[260px] rounded-lg bg-zinc-900 px-2 py-1.5 text-[13px] leading-snug text-white opacity-0 shadow-lg shadow-black/20 transition-[opacity,translate] duration-[120ms] data-[card]:w-80 data-[card]:max-w-80 data-[card]:px-3 data-[card]:py-2.5 data-[on]:opacity-100 motion-reduce:transition-none dark:bg-zinc-100 dark:text-zinc-900"
  >
    <span id="tipText" />
    <span id="tipArrow" className="absolute size-2 rotate-45 bg-inherit" />
  </div>
)

// ---------------------------------------------------------------- the page
export function ProjectPage() {
  useTick((s) => s.view + s.side + s.head + s.list + s.project + s.detail)
  const S = model.S
  const isDesk = desk()
  const page = !!D.page
  // desktop (I70, design A "three panes")
  const inputs = U.tab === 'inputs',
    full = isDesk && D.full && !!U.open && !inputs && !page
  const rail = isDesk && (!wide() || D.sideHidden),
    over = rail && D.sideOpen
  // phone: the item page covers the list and its tabs; the input box stays, now adding to that item
  const d = !!U.open && !page,
    under = !d && !page,
    side = isDesk && !!U.side && !page // T402: Documents, Activity or Deleted in the list column
  const v = isDesk
    ? {
        mainHead: page || full || side,
        items: page || inputs || full,
        inputs: page || !inputs,
        detail: page,
        project: !page,
        foot: (page && !U.prefsEdit) || !!(U.doc && U.docEdit && !OV.spec) || (side && !U.open && !U.doc),
        deskFilters: page || full || inputs || side || !(D.filters || filtersSet().length),
        grip: page || full,
        rail: !rail || page,
        projBar: page,
        drawer: (rail && !over) || page,
        tabs: true,
      }
    : {
        mainHead: !under,
        items: !under || inputs,
        inputs: !under || !inputs,
        detail: !d,
        project: !page,
        foot: (page && !U.prefsEdit) || !!(U.editing && U.editing === U.open),
        deskFilters: true,
        grip: true,
        rail: true,
        projBar: true,
        drawer: !DR.open,
        tabs: !under,
      }
  const wideCls = full ? 'lg:col-start-1 lg:col-span-2' : 'lg:col-start-2'
  useLayoutEffect(() => {
    const waiting = S.items.filter(needsYou).length,
      sec = D.page ? (D.section ? PSEC[D.section][2] : 'Settings') + ' · ' : ''
    document.title = (waiting ? `(${waiting}) ` : '') + sec + (S.project ? `${projTitle()} · Taska` : 'Taska')
    if (!isDesk) {
      setDrawer(DR.open ? drawerW() : 0)
      // B333: a back swipe shows these by hand; when it lands on another item React sees nothing to change, so put
      // them back as this page has them
      if (!SWIPE.back)
        for (const [id, h] of [
          ['itemsView', v.items],
          ['mainHead', v.mainHead],
          ['tabs', v.tabs],
        ] as const) {
          const el = document.getElementById(id)
          if (el && el.hidden !== h) el.hidden = h
        }
    } else {
      const app = document.getElementById('app')
      if (app) {
        app.style.transform = ''
        for (const c of ['rounded-l-3xl', 'overflow-hidden', 'shadow-2xl']) app.classList.remove(c)
      }
      const shade = document.getElementById('drawerShade'),
        drawer = document.getElementById('drawer')
      if (shade) shade.style.left = over && drawer ? drawer.offsetWidth + 'px' : ''
    }
  })
  return (
    <>
      <Drawer hidden={v.drawer} over={over} />
      <Rail hidden={v.rail} />
      <div
        id="drawerShade"
        hidden={isDesk ? !over : !DR.open}
        onClick={closeDrawer}
        className="fixed top-0 right-0 z-30 h-dvh lg:bg-zinc-900/20 dark:lg:bg-black/50"
        aria-label="Close projects"
      />
      <div
        id="app"
        {...(isDesk && D.compose && !page && !inputs ? { 'data-compose': '' } : {})}
        className="group/app relative z-10 mx-auto flex h-full max-w-3xl flex-col bg-white pt-[env(safe-area-inset-top)] md:border-x md:border-zinc-200 lg:mx-0 lg:grid lg:max-w-none lg:min-w-0 lg:flex-1 lg:grid-cols-[var(--list-w,360px)_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] lg:border-x-0 xl:grid-cols-[var(--list-w,420px)_minmax(0,1fr)] 2xl:grid-cols-[var(--list-w,460px)_minmax(0,1fr)] dark:bg-zinc-950 md:dark:border-zinc-800"
      >
        <ProjBar hidden={v.projBar} />
        <MainHead hidden={v.mainHead} />
        <Tabs hidden={v.tabs} />
        {isDesk ? null : <FilterStrip />}
        <DeskFilters hidden={v.deskFilters} />
        <section
          id="itemsView"
          hidden={v.items}
          className="flex min-h-0 flex-1 flex-col lg:col-start-1 lg:row-span-2 lg:row-start-4 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800"
        >
          <List />
        </section>
        <InputsView hidden={v.inputs} />
        <DetailView hidden={v.detail} />
        <ProjectView hidden={v.project} />
        <div
          id="listGrip"
          data-grip="list"
          hidden={v.grip}
          className="group/line relative z-30 cursor-col-resize lg:col-start-1 lg:row-span-4 lg:row-start-2 lg:block lg:w-3 lg:translate-x-1/2 lg:justify-self-end"
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-blue-500 opacity-0 transition-opacity group-hover/line:opacity-100 group-hover/line:delay-150 group-data-drag/line:opacity-100" />
        </div>
        <Foot hidden={v.foot} wideCls={wideCls} />
      </div>
      <Composer />
      <Dialog />
      <Viewer />
      <Tip />
      <VcBar />
      <Toast />
    </>
  )
}
