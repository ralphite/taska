// The foot of the project page: the line about what you sent last, the box, and on the desktop's New input page the
// project's name over the box and what you said under it.

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useLayout } from '../../app/context'
import { usePaneRef } from '../../app/panes'
import { useSideProjects } from '../../app/projectLists'
import type { ProjectRoute } from '../../app/hooks'
import { toneOf } from '../../ui/tones'
import { BoxContainer } from './BoxContainer'
import { ComposeHead } from './ComposeHead'
import type { Fixing } from './Doubts'
import { FeedbackContainer } from './FeedbackContainer'
import { DraftCardContainer, SaidLatelyContainer, useSaidView } from './SaidLatelyContainer'
import { useBoxHere } from '../../app/inputs/boxHere'

/** The foot's height and its box's middle (from the foot's top), for what scrolls under it: where the box floats (dark),
 * the pane runs on under it to the box's middle, around its corners. */
function useFootRoom(hidden: boolean | undefined, onHeight: ((px: number, cut: number) => void) | undefined, boxRef: RefObject<HTMLDivElement | null>) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const foot = ref.current
    if (!foot || typeof ResizeObserver === 'undefined') return
    const set = () => {
      const f = foot.getBoundingClientRect()
      const box = boxRef.current?.getBoundingClientRect()
      // only around the box's top: from its middle down the foot is the page's own colour
      const cut = box ? box.top - f.top + box.height / 2 : f.height
      onHeight?.(foot.hidden ? 0 : foot.offsetHeight, foot.hidden ? 0 : cut)
      foot.style.setProperty('--foot-cut', cut + 'px')
    }
    const ro = new ResizeObserver(set)
    ro.observe(foot)
    set()
    return () => ro.disconnect()
  }, [hidden, onHeight, boxRef])
  return ref
}

export function FootContainer({ route, place, hidden, composePage, onHeight }: { route: ProjectRoute; place: string; hidden?: boolean; composePage: boolean; onHeight?(px: number, cut: number): void }) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const footRef = useFootRoom(hidden, onHeight, boxRef)
  const pane = usePaneRef('foot')
  const desk = useLayout() === 'desk'
  const { title, mode, role, key } = useBoxHere(route)
  const { tones, icons } = useSideProjects(route.slug)
  // kept while the page shows other places, as the page always has
  const saidView = useSaidView()
  const [fixing, setFixing] = useState<Fixing | null>(null)
  return (
    <footer
      ref={(el) => {
        footRef.current = el
        pane(el)
      }}
      hidden={hidden}
      // around the box a press goes through to what is under the foot, a scrollbar running on under it (B739); on the
      // New input page the foot is the page and takes its presses
      className={`relative z-20 shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] after:pointer-events-none after:absolute after:inset-x-0 after:top-(--foot-cut) after:bottom-0 after:-z-10 after:bg-zinc-50 lg:pointer-events-none lg:scrollbar-gutter-both lg:px-8 lg:pb-5 lg:*:pointer-events-auto lg:group-data-[compose]/app:pointer-events-auto lg:group-data-[compose]/app:overflow-y-auto outline-none lg:group-data-[compose]/app:overscroll-contain lg:group-data-[compose]/app:border-transparent lg:group-data-[compose]/app:pt-[5vh] lg:group-data-[compose]/app:pb-16 lg:group-data-[compose]/app:after:hidden lg:hover:scrollbar-thumb-zinc-500/80 dark:border-transparent dark:bg-transparent dark:pt-1 dark:after:bg-zinc-950 dark:lg:hover:scrollbar-thumb-zinc-400/70 ${place}`}
    >
      {desk && composePage ? (
        <ComposeHead title={title} tone={toneOf(tones, route.slug)} icon={icons.get(route.slug)} />
      ) : null}
      <FeedbackContainer route={route} scope={role.scope} boxKey={key} />
      <BoxContainer route={route} composePage={composePage} boxRef={boxRef} />
      {desk && composePage ? (
        <SaidLatelyContainer route={route} boxKey={key} view={saidView} draft={mode ? null : <DraftCardContainer route={route} boxKey={key} scope={role.scope} fixing={fixing} setFixing={setFixing} />} />
      ) : null}
    </footer>
  )
}
