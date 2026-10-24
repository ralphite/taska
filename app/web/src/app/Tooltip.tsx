// One tooltip for the whole page, in the page's own look, for anything with a title (or data-tip, or an icon button's
// label): after half a second under a fine pointer, at once when you move from one to the next, beside the sidebar's
// buttons, under the heads' buttons, above the rest. A key at the end of the words ("Done · D") shows as a key cap.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const TARGET = '[data-tip], [title], button[aria-label], a[aria-label]'

interface Shown {
  el: HTMLElement
  text: string
  key: string
  quick: boolean
}

/** The tip's words: the element's title becomes its data-tip, so the browser's own tooltip never starts. */
function tipText(el: HTMLElement): string {
  if (el.title) {
    el.dataset.tip = el.title
    el.removeAttribute('title')
  }
  return el.dataset.tip || (!el.textContent?.trim() && el.getAttribute('aria-label')) || ''
}

function split(text: string): { text: string; key: string } {
  const lines = text.includes('\n')
  const parts = text.split(' · ')
  const key = !lines && parts.length > 1 && /^(\S{1,4}|G [A-Z]|Esc)$/.test(parts.at(-1) || '') ? (parts.pop() as string) : ''
  return { text: parts.join(' · '), key }
}

export function Tooltip() {
  const [shown, setShown] = useState<Shown | null>(null)
  const [on, setOn] = useState(false)
  const tip = useRef<HTMLDivElement>(null)
  const arrow = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const fine = matchMedia('(hover: hover) and (pointer: fine)')
    let timer = 0
    let current: HTMLElement | null = null
    let closedAt = 0
    let hush: Element | null = null
    const show = (el: HTMLElement, quick: boolean) => {
      const words = tipText(el)
      if (!words || !el.isConnected) return
      current = el
      el.setAttribute('aria-describedby', 'tip')
      setShown({ el, ...split(words), quick })
    }
    const hide = () => {
      clearTimeout(timer)
      if (!current) return
      current.removeAttribute('aria-describedby')
      current = null
      closedAt = Date.now()
      setShown(null)
    }
    const target = (t: EventTarget | null) => (t as Element | null)?.closest?.<HTMLElement>(TARGET) || null
    const over = (e: PointerEvent) => {
      if (!fine.matches || e.pointerType === 'touch') return
      const t = e.target as Element
      if (tip.current?.contains(t)) return clearTimeout(timer)
      const el = target(t)
      if (el === current) return clearTimeout(timer)
      if (!el || el === hush || e.buttons) {
        if (current) {
          clearTimeout(timer)
          timer = window.setTimeout(hide, 100)
        }
        return
      }
      tipText(el)
      const quick = Date.now() - closedAt < 300 || !!current
      clearTimeout(timer)
      if (quick) {
        hide()
        show(el, true)
      } else timer = window.setTimeout(() => show(el, false), 500)
    }
    const out = (e: PointerEvent) => {
      const to = e.relatedTarget as Element | null
      if (hush && !hush.contains(to)) hush = null
      if (to && (tip.current?.contains(to) || (current && current.contains(to)))) return
      clearTimeout(timer)
      if (current) timer = window.setTimeout(hide, 100)
    }
    const focus = (e: FocusEvent) => {
      const el = target(e.target)
      if (fine.matches && el && (e.target as Element).matches(':focus-visible')) {
        hide()
        show(el, true)
      }
    }
    const down = (e: PointerEvent) => {
      if (current || timer) {
        hush = target(e.target)
        hide()
      }
    }
    const key = () => hide()
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('scroll', hide, true)
    document.addEventListener('keydown', key, true)
    addEventListener('resize', hide)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('keydown', key, true)
      removeEventListener('resize', hide)
    }
  }, [])
  useLayoutEffect(() => {
    const t = tip.current
    const a = arrow.current
    // measured, then placed and faded in before the browser paints (React's useLayoutEffect measuring pattern)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(false)
    if (!t || !a || !shown) return
    t.style.transition = shown.quick ? 'none' : ''
    const r = shown.el.getBoundingClientRect()
    const w = t.offsetWidth
    const h = t.offsetHeight
    const gap = 8
    const pad = 8
    // the side a tip takes: its own, or its part of the page's (a sidebar's right, a bar's bottom)
    let side = shown.el.closest<HTMLElement>('[data-tip-side]')?.dataset.tipSide || 'top'
    const room: Record<string, number> = { top: r.top - h - gap, bottom: innerHeight - r.bottom - h - gap, right: innerWidth - r.right - w - gap, left: r.left - w - gap }
    const flip: Record<string, string> = { top: 'bottom', bottom: 'top', right: 'left', left: 'right' }
    if (room[side] < pad && room[flip[side]] > room[side]) side = flip[side]
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    let x: number
    let y: number
    if (side === 'top' || side === 'bottom') {
      x = clamp(r.left + r.width / 2 - w / 2, pad, innerWidth - w - pad)
      y = side === 'top' ? r.top - h - gap : r.bottom + gap
    } else {
      y = clamp(r.top + r.height / 2 - h / 2, pad, innerHeight - h - pad)
      x = side === 'right' ? r.right + gap : r.left - w - gap
    }
    t.style.translate = `${Math.round(x)}px ${Math.round(y)}px`
    const ax = clamp(r.left + r.width / 2 - x - 4, 8, w - 16)
    const ay = clamp(r.top + r.height / 2 - y - 4, 8, h - 16)
    Object.assign(
      a.style,
      side === 'top'
        ? { left: ax + 'px', top: h - 4 + 'px' }
        : side === 'bottom'
          ? { left: ax + 'px', top: '-4px' }
          : side === 'right'
            ? { top: ay + 'px', left: '-4px' }
            : { top: ay + 'px', left: w - 4 + 'px' },
    )
    const f = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(f)
  }, [shown])
  return (
    <div
      id="tip"
      ref={tip}
      role="tooltip"
      hidden={!shown}
      data-on={on ? '' : undefined}
      className="pointer-events-auto fixed top-0 left-0 z-[80] max-w-[260px] rounded-lg bg-zinc-900 px-2 py-1.5 text-[13px] leading-snug text-white opacity-0 shadow-lg shadow-black/20 transition-[opacity,translate] duration-[120ms] data-[on]:opacity-100 motion-reduce:transition-none dark:bg-zinc-100 dark:text-zinc-900"
    >
      <span>
        {shown?.text.split('\n').map((line, i) => (
          <span key={i}>
            {i ? <br /> : null}
            {line}
          </span>
        ))}
        {shown?.key ? (
          <kbd className="ml-1.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded px-1 font-sans text-[11px] font-semibold ring-1 ring-current/30">{shown.key}</kbd>
        ) : null}
      </span>
      <span ref={arrow} className="absolute size-2 rotate-45 bg-inherit" />
    </div>
  )
}
