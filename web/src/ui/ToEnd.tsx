// The button to the talk's end (F716, Yadong r1171, as Codex has it): a small round button with a down arrow, floating
// just above the box over the middle of the talk, never moving what is on the page. It shows while what scrolls the
// talk does not show its end and fades away at the end; a tap scrolls there. The same on the phone and the desktop.
// Props only: the element it is about (`of`, the talk); it listens to what scrolls it while it is shown.

import { useLayoutEffect, useState } from 'react'
import { Icon } from './Icon'
import { PLACE_BUTTON } from './PlaceVoice'
import { scrollerOf, toEndShown } from './scroller'

const LOOK = PLACE_BUTTON.replace('size-7', 'size-9').replace('rounded-lg', 'rounded-full').replace('shadow-sm', 'shadow-md')

export function ToEnd({ of }: { of: HTMLElement | null }) {
  const [shown, setShown] = useState(false)
  useLayoutEffect(() => {
    const sc = of && scrollerOf(of)
    if (!of || !sc) return
    const look = () => setShown(toEndShown(sc))
    sc.addEventListener('scroll', look, { passive: true })
    // the talk grows (a reply comes, you send) or the page round it changes size
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(look)
    for (const part of [sc, of, of.firstElementChild, of.parentElement]) if (part) ro?.observe(part)
    look()
    return () => {
      sc.removeEventListener('scroll', look)
      ro?.disconnect()
    }
  }, [of])
  const go = () => {
    const sc = of && scrollerOf(of)
    sc?.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' })
  }
  return (
    <button
      aria-label="Scroll to bottom"
      title="Scroll to bottom"
      data-to-end={shown ? 'shown' : 'hidden'}
      inert={!shown}
      onClick={go}
      className={`absolute bottom-3 left-1/2 -translate-x-1/2 transition-opacity duration-200 ${LOOK} ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <Icon n="todown" c="size-[18px]" sw="2" />
    </button>
  )
}
