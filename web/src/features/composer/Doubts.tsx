// Words of a voice note that may be misheard. Under the box: what they are and "Use instead" (the desktop), how many
// to check (the phone, the New input page). In the words themselves: the two versions side by side to pick from, and
// on the New input page's draft card, the voice note's own words can be selected and corrected right there. Props only.

import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { unmarked, type Spot } from '../../model/doubts'
import type { Doubt } from '../../model/types'
import { plural } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { LINK_BTN } from '../../ui/tones'

const Alert = ({ cls = '' }: { cls?: string }) => <Icon n="alert" c={`size-3.5 shrink-0 text-amber-600 dark:text-amber-400 ${cls}`} sw="2" />

export type DoubtsView =
  /** the desktop: each one, with the other model's words to use instead */
  | { kind: 'list'; lines: { fk: string; k: number; x: Doubt }[] }
  /** the New input page: they are marked in the draft card under the box */
  | { kind: 'card'; toCheck: number }
  /** the phone: how many, and the words with the two versions in the box */
  | { kind: 'phone'; toCheck: number; showing: boolean }

export function Doubts({ view, on }: { view: DoubtsView; on: { use(fk: string, k: number): void; show(): void } }) {
  let body: ReactNode
  if (view.kind === 'card')
    body = (
      <p className="flex min-h-8 items-center gap-1.5">
        <Alert />
        <span className="min-w-0">{plural(view.toCheck, 'word')} may be misheard. They are marked in the draft below: pick there.</span>
      </p>
    )
  else if (view.kind === 'phone')
    body = (
      <p className="flex min-h-8 items-start gap-1.5 py-1">
        <Alert />
        <span className="min-w-0">
          {view.toCheck ? <b className="font-semibold text-zinc-800 dark:text-zinc-100">{plural(view.toCheck, 'word')} to check</b> : 'Tap the other version to switch before sending.'}
          {view.showing ? null : (
            <>
              {' '}
              <button onClick={on.show} className={`${LINK_BTN} -my-2 inline-flex`}>
                Show the words
              </button>
            </>
          )}
        </span>
      </p>
    )
  else
    body = view.lines.map(({ fk, k, x }) => {
      const [said, heard] = x.show || [x.was, x.alt]
      return (
        <p key={`${fk}-${k}`} className="flex min-h-8 items-center gap-1.5">
          <Alert />
          <span className="min-w-0">
            Maybe misheard: {'“'}
            {unmarked(said)}
            {'”'}
            {x.alt ? ` — the other model heard “${heard}”${x.also?.length ? ` (${x.also.length + 1} places)` : ''} ·` : ' — unsure'}
          </span>
          {x.alt ? (
            <button onClick={() => on.use(fk, k)} className={`${LINK_BTN} -my-1 -ml-1.5 shrink-0`}>
              Use instead
            </button>
          ) : null}
        </p>
      )
    })
  return <div className="flex flex-col px-4 pt-1 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300">{body}</div>
}

/** A correction being typed over the selected words. */
export interface Fixing {
  s: number
  e: number
  wrong: string
}

type Seg = { kind: 'plain'; a: number; b: number; v: boolean } | { kind: 'unsure'; p: Spot } | { kind: 'tog'; p: Spot }

function segments(text: string, spots: readonly Spot[], stretches: readonly (readonly [number, number])[]): Seg[] {
  const inV = (o: number) => stretches.some(([a, b]) => o >= a && o < b)
  const out: Seg[] = []
  const plain = (a: number, b: number) => {
    for (let i = a; i < b; ) {
      const v = inV(i)
      let j = i + 1
      while (j < b && inV(j) === v) j++
      out.push({ kind: 'plain', a: i, b: j, v })
      i = j
    }
  }
  let at = 0
  for (const p of spots) {
    plain(at, p.s)
    at = p.e
    out.push({ kind: p.x.alt ? 'tog' : 'unsure', p })
  }
  plain(at, text.length)
  return out
}

/** The field over the words being corrected: it takes them all at once; Enter keeps, Esc or leaving stops. */
function FixField({ wrong, on }: { wrong: string; on: { save(right: string): void; stop(): void } }) {
  const ref = useRef<HTMLSpanElement>(null)
  const done = useRef(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const all = document.createRange()
    all.selectNodeContents(el)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(all)
  }, [])
  const end = (right: string | null) => {
    if (done.current) return
    done.current = true
    if (right == null) on.stop()
    else on.save(right)
  }
  return (
    <span
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      title="Right words · ↵ keeps, Esc stops"
      className="rounded-md bg-white px-1 py-0.5 text-zinc-900 ring-2 ring-amber-400 outline-none dark:bg-zinc-800 dark:text-zinc-50"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          e.stopPropagation()
          end((e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim())
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          end(null)
        }
      }}
      onBlur={() => end(null)}
    >
      {wrong}
    </span>
  )
}

export interface DraftWordsProps {
  text: string
  spots: readonly Spot[]
  /** the voice notes' own words, which can be selected to correct (the New input page's card) */
  stretches?: readonly (readonly [number, number])[]
  fixing?: Fixing | null
  className?: string
  on: {
    pick(fk: string, k: number, side: 'was' | 'alt'): void
    /** Esc in the versions: back to the box */
    escape(): void
    /** a click on the words, not on a version (the phone: back to typing) */
    plain?(): void
    /** words selected inside a voice note's own words (from s to e in the draft) */
    select?(s: number, e: number): void
    fixSave?(right: string): void
    fixStop?(): void
  }
}

/** The draft's words with the two versions of each misheard word to pick from (left or 1, right or 2 in them). */
export function DraftWords({ text, spots, stretches = [], fixing = null, className = '', on }: DraftWordsProps) {
  const box = useRef<HTMLDivElement>(null)
  const fix = !!on.select
  const field = (key: string) => (fixing ? <FixField key={key} wrong={fixing.wrong} on={{ save: (r) => on.fixSave?.(r), stop: () => on.fixStop?.() }} /> : null)
  // a stretch of words, with the field in it when it is the one being corrected
  const run = (a: number, b: number, v: boolean, key: string, extra?: { unsure: boolean }) => {
    const unsure = extra?.unsure
    const cls = unsure ? `underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-4 ${fix ? 'cursor-text' : ''}` : undefined
    const props = { 'data-o': a, ...(v && fix ? { 'data-v': '' } : {}), ...(unsure && fix ? { 'data-unsure': '' } : {}) }
    if (fixing && fixing.s >= a && fixing.e <= b)
      return (
        <span key={key} {...props} title={unsure ? 'Maybe misheard' : undefined} className={cls}>
          {text.slice(a, fixing.s)}
          {field('fix')}
          {text.slice(fixing.e, b)}
        </span>
      )
    return (
      <span key={key} {...props} title={unsure ? 'Maybe misheard' : undefined} className={cls}>
        {text.slice(a, b)}
      </span>
    )
  }
  const segs = segments(text, spots, fix ? stretches : [])
  const inV = (o: number) => fix && stretches.some(([a, b]) => o >= a && o < b)
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const b = (e.target as Element).closest?.<HTMLElement>('[data-side]')
    if (!b || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      return on.escape()
    }
    const side = ({ ArrowLeft: 'was', 1: 'was', ArrowRight: 'alt', 2: 'alt' } as Record<string, 'was' | 'alt'>)[e.key]
    if (!side) return
    e.preventDefault()
    e.stopPropagation()
    const togs = [...(box.current?.querySelectorAll('[data-tog]') || [])]
    const n = togs.indexOf(b.closest('[data-tog]') as Element)
    on.pick(b.dataset.fk || '', Number(b.dataset.k), side)
    requestAnimationFrame(() => box.current?.querySelectorAll('[data-tog]')[n]?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }))
  }
  const selected = () => {
    const sel = getSelection()
    if (!sel?.rangeCount || sel.isCollapsed || !box.current || box.current.querySelector('[contenteditable]')) return // the correction open already
    const a = sel.anchorNode?.parentElement?.closest<HTMLElement>('[data-o]')
    const b = sel.focusNode?.parentElement?.closest('[data-o]')
    if (!a || a !== b || !a.hasAttribute('data-v') || !box.current.contains(a)) return // within one stretch of a voice note's own words
    const o = Number(a.dataset.o)
    on.select?.(o + Math.min(sel.anchorOffset, sel.focusOffset), o + Math.max(sel.anchorOffset, sel.focusOffset))
  }
  return (
    <div
      ref={box}
      className={className}
      onKeyDown={keys}
      onMouseUp={fix ? () => setTimeout(selected) : undefined}
      onClick={(e) => {
        const t = e.target as Element
        if (t.closest('button') || fixing) return
        const u = fix ? t.closest<HTMLElement>('[data-unsure]') : null
        if (u) {
          // a word the model was not sure of: one click selects it (it was meant to open the correction: findings.md)
          const r = document.createRange()
          r.selectNodeContents(u)
          getSelection()?.removeAllRanges()
          getSelection()?.addRange(r)
          return
        }
        on.plain?.()
      }}
    >
      {segs.map((g, j) => {
        if (g.kind === 'plain') return run(g.a, g.b, g.v, `p${j}`)
        const p = g.p
        if (g.kind === 'unsure') return run(p.s, p.e, true, `u${j}`, { unsure: true })
        const cur = text.slice(p.s, p.e)
        const x = p.x
        let [c0, c1] = x.show && p.o.was.includes(x.show[0]) && p.o.alt.includes(x.show[1]) ? x.show : [p.o.was, p.o.alt] // just the words that differ
        const core = x.pick === 'alt' ? c1 : c0
        const ix = core ? cur.indexOf(core) : -1
        if (ix < 0) [c0, c1] = [p.o.was, p.o.alt]
        const pre = ix < 0 ? '' : cur.slice(0, ix)
        const post = ix < 0 ? '' : cur.slice(ix + core.length)
        const side = x.pick || 'was'
        const btn = (sd: 'was' | 'alt', label: string) => {
          const on2 = side === sd
          return (
            <button
              key={sd}
              data-side={sd}
              data-fk={p.fk}
              data-k={p.k}
              aria-pressed={on2}
              tabIndex={on2 ? 0 : -1}
              title={sd === 'was' ? 'Main model' : 'Other model'}
              onClick={() => on.pick(p.fk, p.k, sd)}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 leading-6 ${on2 ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-700 dark:text-zinc-50 dark:ring-white/10' : 'text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100'}`}
            >
              {on2 && x.pick ? <Icon n="check" c="size-3.5 text-emerald-600 dark:text-emerald-400" sw="2.5" /> : null}
              {unmarked(label)}
            </button>
          )
        }
        return (
          <span key={`t${j}`}>
            {pre ? run(p.s, p.s + pre.length, inV(p.s), `t${j}a`) : null}
            <span
              data-tog
              role="group"
              aria-label="Maybe misheard: two versions"
              className={`mx-0.5 inline-flex items-center gap-px rounded-lg p-0.5 align-baseline whitespace-nowrap ring-1 ${x.pick ? 'bg-zinc-100 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700' : 'bg-amber-100/80 ring-amber-300 dark:bg-amber-400/15 dark:ring-amber-400/40'}`}
            >
              {btn('was', c0)}
              {btn('alt', c1)}
            </span>
            {post ? run(p.e - post.length, p.e, inV(p.e - post.length), `t${j}b`) : null}
          </span>
        )
      })}
    </div>
  )
}
