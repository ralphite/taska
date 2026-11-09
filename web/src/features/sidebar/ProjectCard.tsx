// A project's card beside its row in the sidebar, and beside its icon on the folded rail (F667, as Nota's card beside
// a note): its tile and name; how many things are open, finished, need you; its inputs and documents; the agent last
// heard of; when it last changed. It shows at once while a mouse is over the project, with no delay and no motion,
// right beside the row, its left edge over the sidebar's own (r1066). The pointer can move from the row into it: it
// stays a moment after leaving the row (a hover card's grace), and while the pointer is on it; it goes when the pointer
// has left both, a button goes down on the row (a click, a drag), or the list scrolls. Its name opens the project, as
// the row does. Never on the phone.

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
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
  blocked: 'text-amber-700 dark:text-amber-400',
}

/** The card itself (props only): its stories draw it alone. `href`/`onOpen`: its name opens the project. */
export function ProjectCard({ title, tone, card, href, onOpen }: { title: string; tone: string; card: ProjectCardFacts; href?: string; onOpen?(e: MouseEvent<HTMLAnchorElement>): void }) {
  const open = typeof card.open === 'number' ? card.open : null
  const items = open != null && card.closed != null ? open + card.closed : null
  const any = items !== 0 || card.needs || card.inputs || card.docs || card.agent || card.changed
  return (
    <div data-project-card className="w-80 overflow-hidden rounded-xl bg-white text-sm shadow-lg ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
      <div className="flex items-start gap-2.5 px-4 pt-3.5 pb-3">
        <ProjTile title={title} tone={tone} cls="mt-px size-6 rounded-md text-xs" />
        {href ? (
          <a href={href} onClick={onOpen} className="line-clamp-2 min-w-0 text-[15px] leading-snug font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
            {title}
          </a>
        ) : (
          <span className="line-clamp-2 min-w-0 text-[15px] leading-snug font-semibold text-zinc-900 dark:text-zinc-50">{title}</span>
        )}
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

/** how long the card stays after the pointer leaves the row or the card: time to cross to the other */
const GRACE = 200

/** Which project's card shows, and the handlers its rows and the card take: a mouse over a row (no button held) shows
 * its card at once, right beside the row; leaving the row or the card puts it away after GRACE unless the pointer has
 * come onto the other. */
export function useProjectCard(off = false) {
  const [hovered, setHovered] = useState<Hovered | null>(null)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const stay = () => clearTimeout(timer.current)
  const hide = () => {
    clearTimeout(timer.current)
    setHovered(null)
  }
  const leave = () => {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHovered(null), GRACE)
  }
  const rowProps = (slug: string) =>
    off
      ? {}
      : {
          onPointerEnter: (e: PointerEvent<HTMLElement>) => {
            if (e.pointerType === 'touch' || e.buttons) return
            stay()
            const r = e.currentTarget.getBoundingClientRect()
            setHovered({ slug, left: r.right + 4, top: r.top })
          },
          onPointerLeave: leave,
          onPointerDown: hide,
        }
  /** the pointer on a row when it is drawn (a story's state) */
  const point = (slug: string, el: Element) => {
    const r = el.getBoundingClientRect()
    setHovered({ slug, left: r.right + 4, top: r.top })
  }
  return { hovered: off ? null : hovered, rowProps, card: { onPointerEnter: stay, onPointerLeave: leave }, hide, point }
}

/** The card where the pointer is: over the page (not clipped by the sidebar), kept inside the window. */
export function FloatingProjectCard({
  at,
  title,
  tone,
  card,
  href,
  on,
}: {
  at: Hovered
  title: string
  tone: string
  card: ProjectCardFacts
  href: string
  on: { onPointerEnter(): void; onPointerLeave(): void; open(e: MouseEvent<HTMLAnchorElement>): void }
}) {
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (el) el.style.top = `${Math.round(Math.max(8, Math.min(at.top - 6, innerHeight - el.offsetHeight - 8)))}px`
  })
  return createPortal(
    <div ref={box} role="dialog" aria-label={title} onPointerEnter={on.onPointerEnter} onPointerLeave={on.onPointerLeave} className="fixed z-[70]" style={{ left: at.left, top: at.top - 6 }}>
      <ProjectCard title={title} tone={tone} card={card} href={href} onOpen={on.open} />
    </div>,
    document.body,
  )
}
