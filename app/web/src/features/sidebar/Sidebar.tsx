// The projects: on the desktop the sidebar (or the narrow rail when you fold it), on the phone the drawer. Each
// project with how many things need you there and how many are open; New input, New project; at the foot the
// project's Documents, Activity, Deleted, and Settings. Props only.

import type { ReactNode } from 'react'
import { plural } from '../../model/words'
import { Kbd, ProjTile } from '../../ui/bits'
import { Icon, type IconName } from '../../ui/Icon'

export interface SideProject {
  slug: string
  title: string
  tone: string
  needs: number
  open: number | string
  current: boolean
  href: string
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
  newProject(): void
  hide(): void
  settings(): void
  keys(): void
  go(href: string, e: { preventDefault(): void; metaKey: boolean; ctrlKey: boolean }): void
  undo?(): void
}

export interface SidebarProps {
  phone: boolean
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
  newProjectField?: ReactNode
  on: SidebarEvents
}

const PHONE_ROW =
  'group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 select-none [-webkit-touch-callout:none] hover:bg-zinc-200/50 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-200 data-dragging:bg-zinc-200/70 data-dragging:ring-0 data-drop:bg-blue-100 data-drop:ring-2 data-drop:ring-blue-500 data-pressed:bg-zinc-200/70 dark:hover:bg-zinc-800/60 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:ring-blue-400/30 dark:data-dragging:bg-zinc-800/70 dark:data-drop:bg-blue-400/15 dark:data-drop:ring-blue-400 dark:data-pressed:bg-zinc-800 data-dragging:[&>*]:invisible'
const DESK_ROW =
  'flex items-center gap-2.5 rounded-xl px-2.5 py-2 select-none [-webkit-touch-callout:none] hover:bg-zinc-200/60 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-200 aria-[current=page]:hover:bg-blue-100 data-dragging:bg-zinc-200/70 data-dragging:ring-0 data-drop:bg-blue-100 data-drop:ring-2 data-drop:ring-blue-500 data-pressed:bg-zinc-200/80 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/15 dark:aria-[current=page]:ring-blue-400/30 dark:aria-[current=page]:hover:bg-blue-400/20 dark:data-dragging:bg-zinc-800/70 dark:data-drop:bg-blue-400/15 dark:data-drop:ring-blue-400 dark:data-pressed:bg-zinc-800 data-dragging:[&>*]:invisible'

export function ProjectRows({ phone, projects, on }: { phone: boolean; projects: SideProject[] | null; on: SidebarEvents }) {
  if (!projects) return phone ? <div className="px-3 py-3 text-sm text-zinc-400">Loading…</div> : null
  return (
    <>
      {projects.map((p) =>
        phone ? (
          <a key={p.slug} href={p.href} data-slug={p.slug} aria-current={p.current ? 'page' : undefined} onClick={(e) => on.go(p.href, e)} className={PHONE_ROW}>
            <ProjTile title={p.title} tone={p.tone} cls="size-8 rounded-lg text-sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[17px] font-medium group-aria-[current=page]:font-semibold">{p.title}</span>
                {p.needs ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
                    {p.needs} need you
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{p.open} open</span>
            </span>
          </a>
        ) : (
          <a
            key={p.slug}
            href={p.href}
            data-slug={p.slug}
            aria-current={p.current ? 'page' : undefined}
            onClick={(e) => (p.current ? (e.preventDefault(), on.newInput()) : on.go(p.href, e))}
            className={DESK_ROW}
          >
            <ProjTile title={p.title} tone={p.tone} cls="size-6 rounded-md text-xs" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={`min-w-0 flex-1 truncate text-sm ${p.current ? 'font-semibold' : 'font-medium'}`}>{p.title}</span>
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
  const { phone, projects, composing, links, undoLabel, devLinks, place, hidden, newProjectField, on } = props
  return (
    <nav id="drawer" hidden={hidden} aria-label="Projects" className={`flex h-full flex-col pt-[env(safe-area-inset-top)] dark:bg-zinc-900 ${place}`}>
      <div className="flex h-14 shrink-0 items-center gap-2 px-5 lg:pr-2 lg:pl-4">
        <a
          href="/"
          onClick={(e) => on.go('/', e)}
          title="All projects"
          className="-mx-1.5 flex h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-zinc-200/60 lg:h-9 dark:hover:bg-zinc-800"
        >
          <span className="text-blue-600 dark:text-blue-400">
            <Icon n="logo" c="size-6" sw="2.25" />
          </span>
          <span className="text-xl font-semibold tracking-tight lg:text-[19px]">Taska</span>
        </a>
        <button
          onClick={on.hide}
          title="Hide the sidebar · ["
          aria-label="Hide the sidebar"
          className="ml-auto hidden size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Icon n="panel" c="size-[18px]" />
        </button>
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
            <Kbd k="C" />
          </span>
        </button>
        <button
          onClick={on.newVoice}
          title="New input by voice · ⇧V"
          aria-label="New input by voice"
          className="absolute inset-y-1 right-1 hidden w-9 place-items-center rounded-lg text-zinc-600 group-hover/ni:grid hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
        >
          <Icon n="mic" c="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 lg:scrollbar-thin lg:pb-3 lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:hover:scrollbar-thumb-zinc-400/70">
        <div className="px-3 pb-1.5 text-xs font-semibold text-zinc-500 lg:text-[11px] lg:tracking-wider lg:uppercase dark:text-zinc-400">Projects</div>
        <div className="flex flex-col gap-0.5">
          <ProjectRows phone={phone} projects={projects} on={on} />
        </div>
        {newProjectField ?? (
          <button
            onClick={on.newProject}
            className="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 hover:bg-zinc-200/60 lg:h-9 lg:rounded-xl lg:text-sm dark:text-blue-400 dark:hover:bg-zinc-800"
          >
            <Icon n="plus" c="size-5" />
            New project
          </button>
        )}
      </div>
      {phone ? (
        <div className="mx-2 mt-2 shrink-0 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white dark:divide-zinc-700/60 dark:bg-zinc-800">
          {undoLabel ? (
            <button onClick={on.undo} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]">
              <Icon n="undo" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
              <span className="min-w-0 flex-1 leading-snug">Undo: {undoLabel}</span>
            </button>
          ) : null}
          {links.map((l) => (
            <SideLink key={l.key} link={l} phone on={on} />
          ))}
          <button onClick={on.settings} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px]">
            <Icon n="gear" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0 flex-1">Settings</span>
            <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
          </button>
        </div>
      ) : null}
      {!phone && devLinks?.length ? (
        <div className="flex shrink-0 flex-col gap-0.5 px-2 pb-2">
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
        <div className="flex shrink-0 flex-col gap-0.5 border-t border-zinc-200 p-2 dark:border-zinc-800">
          {links.map((l) => (
            <SideLink key={l.key} link={l} phone={false} on={on} />
          ))}
          <div className="flex items-center gap-0.5">
            <button
              onClick={on.settings}
              className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Icon n="gear" c="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" sw="2" />
              <span className="min-w-0 flex-1 truncate">Settings</span>
              <Kbd k="G S" />
            </button>
            <button
              onClick={on.keys}
              title="Keyboard shortcuts · ?"
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
export function Rail({ projects, composing, settingsOpen, on }: { projects: SideProject[] | null; composing: boolean; settingsOpen: boolean; on: SidebarEvents }) {
  const btn = (key: string, inner: ReactNode, title: string, onClick: () => void, attrs: Record<string, unknown> = {}) => (
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
    <nav id="rail" aria-label="Projects" className="z-30 flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-zinc-50 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      {btn(
        'side',
        <span className="text-blue-600 dark:text-blue-400">
          <Icon n="logo" c="size-6" sw="2.25" />
        </span>,
        'Show the sidebar · [',
        on.hide,
      )}
      {btn('new', <Icon n="newinput" c="size-5" />, 'New input · C', on.newInput, { 'aria-pressed': composing })}
      <div className="my-1 h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
      <div className="-my-1 flex min-h-0 [scrollbar-width:none] flex-col items-center gap-1 overflow-y-auto p-1">
        {(projects || []).map((p) => (
          <a
            key={p.slug}
            href={p.href}
            aria-current={p.current ? 'page' : undefined}
            onClick={(e) => (p.current ? (e.preventDefault(), on.newInput()) : on.go(p.href, e))}
            title={p.title}
            aria-label={p.title}
            className="relative grid size-10 place-items-center rounded-xl hover:bg-zinc-200/60 aria-[current=page]:bg-blue-100 aria-[current=page]:ring-1 aria-[current=page]:ring-blue-300 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-blue-400/20 dark:aria-[current=page]:ring-blue-400/40"
          >
            <ProjTile title={p.title} tone={p.tone} cls="size-7 rounded-lg text-xs" />
            {p.needs ? (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white dark:bg-amber-400 dark:text-amber-950">
                {p.needs}
              </span>
            ) : null}
          </a>
        ))}
      </div>
      {btn('np', <Icon n="plus" c="size-5" />, 'New project', on.newProject)}
      <div className="flex-1" />
      {btn('settings', <Icon n="gear" c="size-5" />, 'Settings · G S', on.settings, settingsOpen ? { 'aria-current': 'page' } : {})}
      {btn('keys', <Icon n="keyboard" c="size-5" />, 'Keyboard shortcuts · ?', on.keys)}
    </nav>
  )
}
