// A project's card beside its row in the sidebar, and beside its icon on the folded rail (F667, as Nota's card beside
// a note): its tile and name; how many things are open, finished, need you; its inputs and documents; the agent last
// heard of; when it last changed. It shows at once while a mouse is over the project, with no delay and no motion,
// and goes when the pointer leaves, a button goes down (a click, a drag), or the list scrolls. Never on the phone;
// it takes no clicks.

import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { AgentTone } from '../../model/agents'
import type { ProjectCardFacts } from '../../model/projects'
import { plural } from '../../model/words'
import { ProjTile } from '../../ui/bits'
import { Icon, StateIcon } from '../../ui/Icon'
import { MUTED } from '../../ui/tones'

const AGENT: Record<AgentTone, string> = {
  ready: 'text-emerald-700 dark:text-emerald-400',
  recent: 'text-emerald-700 dark:text-emerald-400',
  idle: '',
  bad: 'text-red-600 dark:text-red-400',
}

/** The card itself (props only): its stories draw it alone. */
export function ProjectCard({ title, tone, card }: { title: string; tone: string; card: ProjectCardFacts }) {
  const open = typeof card.open === 'number' ? card.open : null
  const items = open != null && card.closed != null ? open + card.closed : null
  const any = items !== 0 || card.needs || card.inputs || card.docs || card.agent || card.changed
  return (
    <div data-project-card className="w-80 overflow-hidden rounded-xl bg-white text-sm shadow-lg ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
      <div className="flex items-start gap-2.5 px-4 pt-3.5 pb-3">
        <ProjTile title={title} tone={tone} cls="mt-px size-6 rounded-md text-xs" />
        <span className="line-clamp-2 min-w-0 text-[15px] leading-snug font-semibold text-zinc-900 dark:text-zinc-50">{title}</span>
      </div>
      {any ? (
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 bg-zinc-50 px-4 py-2 text-xs dark:border-zinc-700/60 dark:bg-zinc-900/40 ${MUTED}`}>
        {items !== 0 ? (
          <span data-card-open className="inline-flex items-center gap-1">
            <StateIcon s="open" cls="size-3.5" tone="text-current" />
            {card.open} open
          </span>
        ) : null}
        {items ? (
          <span data-card-closed className="inline-flex items-center gap-1">
            <StateIcon s="done" cls="size-3.5" tone="text-current" />
            {card.closed} closed · {plural(items, 'item')}
          </span>
        ) : null}
        {card.needs ? (
          <span data-card-needs className="inline-flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-200">
            <StateIcon s="wait" cls="size-3.5" />
            {card.needs} {card.needs === 1 ? 'needs' : 'need'} you
          </span>
        ) : null}
        {card.inputs ? (
          <span className="inline-flex items-center gap-1">
            <Icon n="newinput" c="size-3.5" sw="2" />
            {plural(card.inputs, 'input')}
          </span>
        ) : null}
        {card.docs ? (
          <span className="inline-flex items-center gap-1">
            <Icon n="doc" c="size-3.5" sw="2" />
            {plural(card.docs, 'doc')}
          </span>
        ) : null}
        {card.agent ? (
          <span data-card-agent className={`inline-flex min-w-0 items-center gap-1 ${AGENT[card.agent.tone]}`}>
            <Icon n="bot" c="size-3.5" sw="2" />
            <span className="truncate">{card.agent.label}</span>
          </span>
        ) : null}
        {card.changed ? (
          <span className="ml-auto inline-flex items-center gap-1">
            <Icon n="clock" c="size-3.5" sw="2" />
            {card.changed}
          </span>
        ) : null}
      </div>
      ) : null}
    </div>
  )
}

interface Hovered {
  slug: string
  left: number
  top: number
}

/** Which project's card shows, and the handlers its rows take: a mouse over a row (no button held) shows its card
 * beside `edge` (the sidebar or the rail), level with the row. */
export function useProjectCard(edge: RefObject<HTMLElement | null>, off = false) {
  const [hovered, setHovered] = useState<Hovered | null>(null)
  const hide = () => setHovered(null)
  const rowProps = (slug: string) =>
    off
      ? {}
      : {
          onPointerEnter: (e: PointerEvent<HTMLElement>) => {
            if (e.pointerType === 'touch' || e.buttons) return
            const r = e.currentTarget.getBoundingClientRect()
            setHovered({ slug, left: (edge.current?.getBoundingClientRect().right ?? r.right) + 8, top: r.top })
          },
          onPointerLeave: hide,
          onPointerDown: hide,
        }
  return { hovered: off ? null : hovered, rowProps, hide }
}

/** The card where the pointer is: over the page (not clipped by the sidebar), kept inside the window. */
export function FloatingProjectCard({ at, title, tone, card }: { at: Hovered; title: string; tone: string; card: ProjectCardFacts }) {
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (el) el.style.top = `${Math.round(Math.max(8, Math.min(at.top - 6, innerHeight - el.offsetHeight - 8)))}px`
  })
  return createPortal(
    <div ref={box} role="tooltip" className="pointer-events-none fixed z-[70]" style={{ left: at.left, top: at.top - 6 }}>
      <ProjectCard title={title} tone={tone} card={card} />
    </div>,
    document.body,
  )
}
