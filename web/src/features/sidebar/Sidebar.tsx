// The projects: on the desktop the sidebar (or the narrow rail when you fold it), on the phone the drawer. Each
// project with how many things need you there and how many are open; New input, New project; at the foot the
// project's Documents, Activity, Deleted, and Settings; on the desktop a project's card beside it while the pointer is
// on it (F667). Props only.

import { useLayoutEffect, useRef, type MouseEvent, type ReactNode, type Ref, type RefObject } from 'react'
import type { ProjectCardFacts } from '../../model/projects'
import { useOrderDrag } from './orderDrag'
import { FloatingProjectCard, useProjectCard } from './ProjectCard'
import { Kbd, NeedsCount, ProjTile, Skeleton, pressedMark } from '../../ui/bits'
import { Icon, type IconName } from '../../ui/Icon'
import { PULL } from '../../ui/tones'

export interface SideProject {
  slug: string
  title: string
  tone: string
  icon?: string
  needs: number
  open: number | string
  current: boolean
  href: string
  /** an item dragged from the list would move here */
  drop?: boolean
  /** pressed (a finger on it), being dragged to a new place, or under the pointer (its card beside it) when drawn */
  look?: 'pressed' | 'dragging' | 'pointed'
  /** what its card under the pointer says */
  card: ProjectCardFacts
}

export interface SideLinkInfo {
  key: 'docs' | 'log' | 'deleted'
  label: string
  icon: IconName
  href: string
  current: boolean
}

export interface SidebarEvents {
  newInput(): void
  newVoice(): void
  /** New project, from its button: a popover there on the desktop (`beside`: right of it, from the rail), a sheet on
   * the phone (D115 #7) */
  newProject(from: HTMLElement, beside?: boolean): void
  hide(): void
  settings(): void
  /** how agents get work, without spending tokens (F613) */
  help(): void
  keys(): void
  go(href: string, e: { preventDefault(): void; metaKey: boolean; ctrlKey: boolean }): void
  undo(): void
  /** the projects dragged into this order (`moved`: the one you held) */
  order(names: string[], moved: string): void
  /** an item from the list dragged over a project (null: off them); -> it can go there */
  dragProject(slug: string | null): boolean
  dropProject(): void
  /** a project's menu, at the pointer (right-click, the desktop) */
  projectMenu(slug: string, x: number, y: number): void
  /** the desktop's search (F479): every project, by meaning and by the words */
  search(): void
}

/** the keys its buttons show (the actions' table has them) */
export interface SideKeys {
  search: string
  newInput: string
  voice: string
  settings: string
  sidebar: string
  keys: string
  /** Documents, Activity, Deleted: their keys by the link's key */
  links: Record<SideLinkInfo['key'], string>
}

export interface SidebarProps {
  phone: boolean
  keys: SideKeys
  /** the phone's card at the drawer's foot (the toast sits above it) */
  footRef?: Ref<HTMLDivElement>
  /** null: never listed in this browser yet */
  projects: SideProject[] | null
  composing: boolean
  links: SideLinkInfo[]
  /** the drawer's Undo (a phone has no Z) */
  undoLabel?: string | null
  devLinks?: { label: string; href: string; icon: IconName }[]
  /** where the sidebar sits (the layout says) */
  place: string
  hidden?: boolean
  /** its right edge, to drag wider or narrower (the desktop) */
  edge?: ReactNode
  /** Taska, at its top, pressed (a finger on it) */
  brandPressed?: boolean
  on: SidebarEvents
}

const PHONE_ROW =
  'group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 select-none [-webkit-touch-callout:none] hover:bg-zinc-200/50 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-200 data-dragging:bg-zinc-200/70 data-dragging:ring-0 data-pressed:bg-zinc-200/70 dark:hover:bg-zinc-800/60 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:ring-blue-400/30 dark:data-dragging:bg-zinc-800/70 dark:data-pressed:bg-zinc-800 data-dragging:[&>*]:invisible'
const DESK_ROW =
  'flex items-center gap-2.5 rounded-xl px-2.5 py-2 select-none [-webkit-touch-callout:none] hover:bg-zinc-200/60 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-200 aria-[current=page]:hover:bg-blue-100 data-dragging:bg-zinc-200/70 data-dragging:ring-0 data-drop:bg-blue-100 data-drop:ring-2 data-drop:ring-blue-500 data-pressed:bg-zinc-200/80 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:ring-blue-400/30 dark:aria-[current=page]:hover:bg-blue-400/20 dark:data-dragging:bg-zinc-800/70 dark:data-drop:bg-blue-400/15 dark:data-drop:ring-blue-400 dark:data-pressed:bg-zinc-800 data-dragging:[&>*]:invisible'

type CardOn = ReturnType<typeof useProjectCard>

/** A row drawn pressed or being dragged, as the page marks it while a finger is on it or drags it. */
const rowLook = (p: SideProject) => (p.look === 'pressed' ? { 'data-pressed': '' } : p.look === 'dragging' ? { 'data-dragging': '' } : {})

/** The project drawn under the pointer: its card shows beside its row, as when a mouse comes onto it. */
function usePointed(projects: SideProject[] | null, rows: RefObject<HTMLElement | null>, point: CardOn['point']) {
  const slug = projects?.find((p) => p.look === 'pointed')?.slug
  useLayoutEffect(() => {
    const el = slug ? rows.current?.querySelector(`a[data-slug="${CSS.escape(slug)}"]`) : null
    if (!slug || !el) return
    // again once what is round it is laid out (a story's frame says its width above it once it is drawn)
    const again = () => el.isConnected && point(slug, el)
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(again)))
    void document.fonts?.ready.then(again)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- where the pointer is when drawn, once
  }, [slug])
}

/** the card of the project under the pointer, if it is still listed; its name opens the project as the row does */
function HoverCard({ hover, projects, on }: { hover: CardOn; projects: SideProject[] | null; on: SidebarEvents }) {
  const p = hover.hovered && projects?.find((x) => x.slug === hover.hovered?.slug)
  if (!p || !hover.hovered) return null
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    hover.hide()
    if (p.current) {
      e.preventDefault()
      on.newInput()
    } else on.go(p.href, e)
  }
  const menu = (from: HTMLElement) => {
    hover.hide()
    const r = from.getBoundingClientRect()
    on.projectMenu(p.slug, r.left, r.bottom)
  }
  return <FloatingProjectCard at={hover.hovered} title={p.title} tone={p.tone} icon={p.icon} card={p.card} href={p.href} on={{ ...hover.card, open, menu }} />
}

function ProjectRows({ phone, projects, hover, on }: { phone: boolean; projects: SideProject[] | null; hover: CardOn; on: SidebarEvents }) {
  if (!projects) return phone ? <Skeleton shape="tile" cls="py-1.5" /> : null
  return (
    <>
      {projects.map((p) =>
        phone ? (
          <a key={p.slug} href={p.href} data-slug={p.slug} {...rowLook(p)} aria-current={p.current ? 'page' : undefined} onClick={(e) => on.go(p.href, e)} className={PHONE_ROW}>
            <ProjTile title={p.title} tone={p.tone} icon={p.icon} cls="size-8 rounded-lg text-sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[17px] font-medium group-aria-[current=page]:font-semibold">{p.title}</span>
                {p.needs ? <NeedsCount n={p.needs} /> : null}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{p.open} open</span>
            </span>
          </a>
        ) : (
          <a
            key={p.slug}
            href={p.href}
            data-slug={p.slug}
            {...(p.drop ? { 'data-drop': '' } : {})}
            {...rowLook(p)}
            {...hover.rowProps(p.slug)}
            onContextMenu={(e) => {
              e.preventDefault()
              on.projectMenu(p.slug, e.clientX, e.clientY)
            }}
            aria-current={p.current ? 'page' : undefined}
            onClick={(e) => (p.current ? (e.preventDefault(), on.newInput()) : on.go(p.href, e))}
            className={`group/row ${DESK_ROW}`}
          >
            <ProjTile title={p.title} tone={p.tone} icon={p.icon} cls="size-6 rounded-md text-xs" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={`min-w-0 flex-1 truncate text-sm ${p.current ? 'font-semibold' : 'font-medium'}`}>{p.title}</span>
                {/* under the pointer its count gives way to ⋯, the project's menu (as a right click; F767) */}
                <span className="grid shrink-0 place-items-center *:col-start-1 *:row-start-1">
                  {p.needs ? <span className="group-hover/row:invisible">{<NeedsCount n={p.needs} />}</span> : null}
                  <span
                    role="button"
                    aria-label={`${p.title}: menu`}
                    title="Menu"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      hover.hide()
                      const r = e.currentTarget.getBoundingClientRect()
                      on.projectMenu(p.slug, r.left, r.bottom)
                    }}
                    className="invisible -my-1 grid size-6 place-items-center rounded-md text-zinc-500 group-hover/row:visible hover:bg-zinc-300/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                  >
                    <Icon n="more" c="size-4" />
                  </span>
                </span>
              </span>
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{p.open} open</span>
            </span>
          </a>
        ),
      )}
    </>
  )
}

function SideLink({ link, phone, on }: { link: SideLinkInfo; phone: boolean; on: SidebarEvents }) {
  return phone ? (
    <a href={link.href} onClick={(e) => on.go(link.href, e)} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]">
      <Icon n={link.icon} c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1">{link.label}</span>
      <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
    </a>
  ) : (
    <a
      href={link.href}
      onClick={(e) => on.go(link.href, e)}
      aria-current={link.current ? 'page' : undefined}
      className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 aria-[current=page]:bg-zinc-200/80 aria-[current=page]:font-medium aria-[current=page]:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-zinc-800 dark:aria-[current=page]:text-zinc-50"
    >
      <Icon n={link.icon} c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
      <span className="min-w-0 flex-1 truncate">{link.label}</span>
    </a>
  )
}

export function Sidebar(props: SidebarProps) {
  const { phone, keys, projects, composing, links, undoLabel, devLinks, place, hidden, edge, footRef, brandPressed, on } = props
  const rows = useRef<HTMLDivElement>(null)
  const hover = useProjectCard(phone || !!hidden)
  usePointed(projects, rows, hover.point)
  useOrderDrag(rows, (names, moved) => on.order(names, moved), (slug, x, y) => on.projectMenu(slug, x, y))
  return (
    <nav id="drawer" data-tip-side="right" hidden={hidden} aria-label="Projects" className={`flex h-full flex-col pt-[env(safe-area-inset-top)] dark:bg-zinc-900 ${place}`}>
      {edge}
      <div className="flex h-14 shrink-0 items-center gap-2 px-5 lg:pr-2 lg:pl-4">
        <a
          href="/"
          onClick={(e) => on.go('/', e)}
          title="All projects"
          {...pressedMark(brandPressed)}
          className="-mx-1.5 flex h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-zinc-200/60 lg:h-9 dark:hover:bg-zinc-800"
        >
          <span className="text-blue-600 dark:text-blue-400">
            <Icon n="logo" c="size-6" sw="2.25" />
          </span>
          <span className="text-xl font-semibold tracking-tight lg:text-[19px]">Taska</span>
        </a>
        <div className="ml-auto flex items-center gap-0.5">
          {!phone ? (
            <button
              onClick={on.search}
              title={`Search · ${keys.search}`}
              aria-label="Search"
              className="hidden size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Icon n="search" c="size-[18px]" />
            </button>
          ) : null}
          <button
            onClick={on.hide}
            title={`Hide sidebar · ${keys.sidebar}`}
            aria-label="Hide sidebar"
            className="hidden size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Icon n="panel" c="size-[18px]" />
          </button>
        </div>
      </div>
      <div className="group/ni relative mx-2.5 mb-3 hidden shrink-0 lg:block">
        <button
          onClick={on.newInput}
          aria-pressed={composing}
          className="flex h-9 w-full items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-50 aria-pressed:bg-blue-50 aria-pressed:text-blue-700 aria-pressed:ring-blue-500/40 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-700 dark:aria-pressed:bg-blue-400/10 dark:aria-pressed:text-blue-300 dark:aria-pressed:ring-blue-400/40"
        >
          <Icon n="newinput" c="size-4" />
          <span className="flex-1 text-left">New input</span>
          <span className="group-hover/ni:invisible">
            <Kbd k={keys.newInput} />
          </span>
        </button>
        <button
          onClick={on.newVoice}
          title={`New input by voice · ${keys.voice}`}
          aria-label="New input by voice"
          className="absolute inset-y-1 right-1 hidden w-9 place-items-center rounded-lg text-zinc-600 group-hover/ni:grid hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
        >
          <Icon n="mic" c="size-4" />
        </button>
      </div>
      <div onScroll={hover.hide} className={`${PULL} min-h-0 flex-1 overflow-y-auto outline-none overscroll-contain px-2 lg:scrollbar-thin lg:pb-6 lg:mask-b-from-[calc(100%-1.5rem)] lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70`}>
        <div className="px-3 pb-1.5 text-xs font-semibold text-zinc-500 lg:text-[11px] lg:tracking-wider lg:uppercase dark:text-zinc-400">Projects</div>
        <div
          ref={rows}
          className="flex flex-col gap-0.5"
          onDragEnter={hover.hide}
          onDragOver={(e) => {
            // an item dragged from the list onto another project moves there
            const a = (e.target as Element).closest<HTMLElement>('a[data-slug]')
            if (!on.dragProject(a?.dataset.slug ?? null)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) on.dragProject(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            on.dropProject()
          }}
        >
          <ProjectRows phone={phone} projects={projects} hover={hover} on={on} />
        </div>
        <HoverCard hover={hover} projects={projects} on={on} />
        <button
          onClick={(e) => on.newProject(e.currentTarget)}
          className="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 hover:bg-zinc-200/60 lg:h-9 lg:rounded-xl lg:text-sm dark:text-blue-400 dark:hover:bg-zinc-800"
        >
          <Icon n="plus" c="size-5" />
          New project
        </button>
      </div>
      {phone ? (
        <div ref={footRef} className="mx-2 mt-2 shrink-0 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white dark:divide-zinc-700/60 dark:bg-zinc-800">
          {undoLabel ? (
            <button onClick={on.undo} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]">
              <Icon n="undo" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
              <span className="min-w-0 flex-1 leading-snug">Undo: {undoLabel}</span>
            </button>
          ) : null}
          {links.map((l) => (
            <SideLink key={l.key} link={l} phone on={on} />
          ))}
          <button onClick={on.help} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]">
            <Icon n="info" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0 flex-1">Help</span>
            <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
          </button>
          <button onClick={on.settings} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]">
            <Icon n="gear" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0 flex-1">Settings</span>
            <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
          </button>
        </div>
      ) : null}
      {!phone && devLinks?.length ? (
        <div data-dev-links className="flex shrink-0 flex-col gap-0.5 px-2 pb-2">
          <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">Dev</div>
          {devLinks.map((d) => (
            <a
              key={d.label}
              href={d.href}
              target="_blank"
              rel="noopener"
              className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Icon n={d.icon} c="size-4 shrink-0 text-violet-500 dark:text-violet-400" sw="2" />
              <span className="min-w-0 flex-1 truncate">{d.label}</span>
            </a>
          ))}
        </div>
      ) : null}
      {!phone ? (
        <div data-side-foot className="flex shrink-0 flex-col gap-0.5 border-t border-zinc-200 p-2 dark:border-zinc-800">
          {links.map((l) => (
            <SideLink key={l.key} link={l} phone={false} on={on} />
          ))}
          <button
            onClick={on.help}
            className="flex h-9 min-w-0 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Icon n="info" c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
            <span className="min-w-0 flex-1 truncate">Help</span>
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={on.settings}
              className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Icon n="gear" c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
              <span className="min-w-0 flex-1 truncate">Settings</span>
              <Kbd k={keys.settings} />
            </button>
            <button
              onClick={on.keys}
              title={`Keyboard shortcuts · ${keys.keys}`}
              aria-label="Keyboard shortcuts"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Icon n="keyboard" c="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </nav>
  )
}

/** The sidebar folded: a narrow rail of the same. */
export function Rail({ keys, projects, links, composing, settingsOpen, hidden, on }: { keys: SideKeys; projects: SideProject[] | null; links: SideLinkInfo[]; composing: boolean; settingsOpen: boolean; hidden?: boolean; on: SidebarEvents }) {
  const hover = useProjectCard(!!hidden)
  // the projects more than it holds: its edges fade where more of them are above or below (no scrollbar on the rail)
  const list = useRef<HTMLDivElement>(null)
  usePointed(projects, list, hover.point)
  const edges = () => {
    const el = list.current
    if (!el) return
    el.toggleAttribute('data-up', el.scrollTop > 1)
    el.toggleAttribute('data-down', el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }
  useLayoutEffect(() => {
    const el = list.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(edges)
    ro.observe(el)
    edges()
    return () => ro.disconnect()
  })
  const btn = (key: string, inner: ReactNode, title: string, onClick: (e: MouseEvent<HTMLButtonElement>) => void, attrs: Record<string, unknown> = {}) => (
    <button
      key={key}
      onClick={onClick}
      {...attrs}
      title={title}
      aria-label={title.split(' · ')[0]}
      className="relative grid size-10 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 aria-pressed:bg-zinc-200/80 aria-pressed:text-zinc-900 aria-[current=page]:bg-zinc-200/80 aria-[current=page]:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-pressed:bg-zinc-700 dark:aria-pressed:text-zinc-50 dark:aria-[current=page]:bg-zinc-700 dark:aria-[current=page]:text-zinc-50"
    >
      {inner}
    </button>
  )
  return (
    <nav id="rail" data-tip-side="right" hidden={hidden} aria-label="Projects" className="z-30 flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-zinc-50 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      {btn(
        'side',
        <span className="text-blue-600 dark:text-blue-400">
          <Icon n="logo" c="size-6" sw="2.25" />
        </span>,
        `Show sidebar · ${keys.sidebar}`,
        on.hide,
      )}
      {btn('search', <Icon n="search" c="size-5" />, `Search · ${keys.search}`, on.search)}
      {btn('new', <Icon n="newinput" c="size-5" />, `New input · ${keys.newInput}`, on.newInput, { 'aria-pressed': composing })}
      <div className="my-1 h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
      <div ref={list} onScroll={() => (hover.hide(), edges())} className="-my-1 flex min-h-0 w-full [scrollbar-width:none] flex-col items-center gap-1 overflow-y-auto outline-none py-1 data-down:mask-b-from-[calc(100%-1.5rem)] data-up:mask-t-from-[calc(100%-1.5rem)]">
        {(projects || []).map((p) => (
          <a
            key={p.slug}
            href={p.href}
            data-slug={p.slug}
            {...hover.rowProps(p.slug)}
            aria-current={p.current ? 'page' : undefined}
            onClick={(e) => (p.current ? (e.preventDefault(), on.newInput()) : on.go(p.href, e))}
            aria-label={p.title}
            className="relative grid size-10 shrink-0 place-items-center rounded-xl hover:bg-zinc-200/60 focus-visible:outline-2 focus-visible:outline-blue-500 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-300 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/20 dark:aria-[current=page]:ring-blue-400/40"
          >
            <ProjTile title={p.title} tone={p.tone} icon={p.icon} cls="size-7 rounded-lg text-xs" />
            {p.needs ? (
              <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-white ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/15">
                <NeedsCount n={p.needs} />
              </span>
            ) : null}
          </a>
        ))}
      </div>
      <HoverCard hover={hover} projects={projects} on={on} />
      {btn('np', <Icon n="plus" c="size-5" />, 'New project', (e) => on.newProject(e.currentTarget, true))}
      <div className="flex-1" />
      {/* this project's Documents, Activity and Deleted, as the sidebar's foot has them */}
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          onClick={(e) => on.go(l.href, e)}
          aria-current={l.current ? 'page' : undefined}
          title={`${l.label} · ${keys.links[l.key]}`}
          aria-label={l.label}
          className="relative grid size-10 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 aria-[current=page]:bg-zinc-200/80 aria-[current=page]:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-zinc-700 dark:aria-[current=page]:text-zinc-50"
        >
          <Icon n={l.icon} c="size-5" />
        </a>
      ))}
      {links.length ? <div className="my-1 h-px w-8 bg-zinc-200 dark:bg-zinc-800" /> : null}
      {btn('help', <Icon n="info" c="size-5" />, 'Help', on.help)}
      {btn('settings', <Icon n="gear" c="size-5" />, `Settings · ${keys.settings}`, on.settings, settingsOpen ? { 'aria-current': 'page' } : {})}
      {btn('keys', <Icon n="keyboard" c="size-5" />, `Keyboard shortcuts · ${keys.keys}`, on.keys)}
    </nav>
  )
}
