// One tooltip for the whole page, in the page's own look, for anything with a title (or data-tip, or an icon button's
// label): after half a second under a fine pointer, at once when you move from one to the next, beside the sidebar's
// buttons, under the heads' buttons, above the rest. A key at the end of the words ("Done · D") shows as a key cap. A
// code in some words (data-ref) shows a card about what it names instead; a voice note's play button (data-heard) shows
// its original words: word for word, and tidied (what agents get) when they differ (B640). It shows and hides at
// once, where it belongs: no fade, no movement (B665).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefCard } from '../model/refCard'

const TARGET = '[data-ref], [data-heard], [data-tip], [title], button[aria-label], a[aria-label]'

interface Shown {
  el: HTMLElement
  text: string
  key: string
  card: RefCard | null
  /** a voice note's words: as said, and tidied */
  said: { heard: string; tidied: string } | null
}

/** The tip's words: the element's title becomes its data-tip, so the browser's own tooltip never starts. An element
 * named only by its title (an icon button) keeps that name as its aria-label, for screen readers and keys. */
function tipText(el: HTMLElement): string {
  if (el.title) {
    if (!el.getAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', el.title.split(' · ')[0])
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

/** A voice note's words: word for word, then tidied (what the organizer and agents get), as its sheet shows them on
 * the phone (F568). */
function SaidWords({ heard, tidied }: { heard: string; tidied: string }) {
  const part = (label: string, text: string) => (
    <div>
      <div className="text-[11px] font-medium opacity-70">{label}</div>
      <p className="mt-0.5 break-words whitespace-pre-wrap">{text}</p>
    </div>
  )
  if (heard && tidied && heard !== tidied)
    return (
      <span className="flex flex-col gap-3">
        {part('Word for word', heard)}
        {part('Tidied · what agents get', tidied)}
      </span>
    )
  return <span>{part('Not tidied: words as said', heard || tidied || 'No words heard')}</span>
}

/** `card`: what a code names, as its card (read when it shows). */
export function Tooltip({ card }: { card(ref: string): RefCard | null }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const tip = useRef<HTMLDivElement>(null)
  const arrow = useRef<HTMLSpanElement>(null)
  const told = useRef(card)
  useEffect(() => {
    told.current = card
  })
  useEffect(() => {
    const fine = matchMedia('(hover: hover) and (pointer: fine)')
    let timer = 0
    let current: HTMLElement | null = null
    let closedAt = 0
    let hush: Element | null = null
    const show = (el: HTMLElement) => {
      const c = el.dataset.ref ? told.current(el.dataset.ref) : null
      const said = el.dataset.heard !== undefined ? { heard: el.dataset.heard, tidied: el.dataset.tidied ?? '' } : null
      const words = c || said ? '' : tipText(el)
      if ((!c && !said && !words) || !el.isConnected) return
      current = el
      el.setAttribute('aria-describedby', 'tip')
      setShown({ el, ...split(words), card: c, said })
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
        show(el)
      } else timer = window.setTimeout(() => show(el), 500)
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
        show(el)
      }
    }
    const down = (e: PointerEvent) => {
      if (current || timer) {
        hush = target(e.target)
        hide()
      }
    }
    const key = () => hide()
    // a long voice note's words scroll inside the tip: that does not close it
    const scroll = (e: Event) => !tip.current?.contains(e.target as Node) && hide()
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('scroll', scroll, true)
    document.addEventListener('keydown', key, true)
    addEventListener('resize', hide)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('scroll', scroll, true)
      document.removeEventListener('keydown', key, true)
      removeEventListener('resize', hide)
    }
  }, [])
  useLayoutEffect(() => {
    const t = tip.current
    const a = arrow.current
    // measured and placed before the browser paints, so it appears where it belongs (B665: nothing flies in)
    if (!t || !a || !shown) return
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
  }, [shown])
  return (
    <div
      id="tip"
      ref={tip}
      role="tooltip"
      hidden={!shown}
      data-card={shown?.card ? '' : undefined}
      data-said={shown?.said ? '' : undefined}
      className="pointer-events-auto fixed top-0 left-0 z-[80] max-w-[260px] rounded-lg bg-zinc-900 px-2 py-1.5 text-[13px] leading-snug text-white shadow-lg shadow-black/20 data-[card]:w-80 data-[card]:max-w-80 data-[card]:px-3 data-[card]:py-2.5 data-[said]:max-h-[60dvh] data-[said]:w-96 data-[said]:max-w-[calc(100vw-1rem)] data-[said]:overflow-y-auto data-[said]:px-3 data-[said]:py-2.5 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {shown?.said ? (
        <SaidWords {...shown.said} />
      ) : shown?.card ? (
        <span>
          <div className="text-[11px] font-medium opacity-70">{shown.card.top}</div>
          {shown.card.name ? <div className="mt-0.5 font-semibold">{shown.card.name}</div> : null}
          {shown.card.gist ? <div className="mt-1 line-clamp-4 opacity-80">{shown.card.gist}</div> : null}
        </span>
      ) : (
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
      )}
      <span ref={arrow} className="absolute size-2 rotate-45 bg-inherit" />
    </div>
  )
}
