// T522 (r731, r762, #6303): what a part shows only under the pointer, from the keyboard, while pressed, picked or
// dragged, drawn without any of them and side by side, so every look of one part is seen at once and compared. Each
// look is the real component on the demo's data; the pointer and the keyboard are the page's own CSS rules
// (:hover, :focus-visible, :focus-within), turned on for the parts named here by storybook-addon-pseudo-states; a press,
// a drag and a drop are the attributes the page's own code sets on them (lib/events.ts press: data-pressed; the list's
// and the sidebar's drag: data-dragging, data-drop, data-drag).
import type { StoryObj } from '@storybook/react-vite'
import { useEffect, type ReactNode } from 'react'
import { Tip } from '../../components/Shell'
import { tipShow } from '../../lib/events'
import type { Setup } from './demo'

export interface Look {
  /** what this look is, in a few words (Storybook's label, not the page's) */
  name: string
  /** the real component, on the demo's data */
  draw: () => ReactNode
  /** under the pointer: what these find in this look */
  hover?: string[]
  /** focused from the keyboard (Tab) */
  focus?: string[]
  /** the mouse held down on it (the few parts that use :active, not the page's press) */
  active?: string[]
  /** a box with the field in it focused */
  within?: string[]
  /** a finger or the mouse down on it */
  pressed?: string[]
  /** what the page's own code marks on it: [what, attribute, value] (a row dragged, the place it would drop) */
  marks?: [string, string, string][]
  /** scrolled to this, as you would to see it (a part far down a pane) */
  scroll?: string
}

const at = (i: number, sels: string[] = []) => sels.map((s) => `[data-look="${i}"] ${s}`)

const PSEUDO = [
  ['hover', 'pseudo-hover'],
  ['focus', 'pseudo-focus-visible'],
  ['within', 'pseudo-focus-within'],
  ['active', 'pseudo-active'],
] as const

function Marks({ looks }: { looks: Look[] }) {
  useEffect(() => {
    // once the parts have drawn, and again once they have settled (a pane that scrolls itself as it opens)
    const mark = () =>
      looks.forEach((l, i) => {
        // a part that draws after the story (its list loaded, a pane opened) gets its pointer and keys here, with the
        // classes the addon itself sets on what it finds when the story draws
        for (const [k, cls] of PSEUDO)
          for (const s of at(i, l[k])) document.querySelectorAll(s).forEach((el) => el.classList.add(cls))
        for (const s of at(i, l.pressed))
          document.querySelectorAll(s).forEach((el) => el.setAttribute('data-pressed', ''))
        for (const [s, a, v] of l.marks || [])
          document.querySelectorAll(at(i, [s])[0]).forEach((el) => el.setAttribute(a, v))
        // the part's own scroller, as a wheel would scroll it (not the look's frame, nor the page of looks)
        const el = l.scroll && document.querySelector<HTMLElement>(at(i, [l.scroll])[0])
        let p = el ? el.parentElement : null
        while (p && !/auto|scroll/.test(getComputedStyle(p).overflowY)) p = p.parentElement
        if (el && p) p.scrollTop += el.getBoundingClientRect().top - p.getBoundingClientRect().top - 8
      })
    const t = [300, 1500].map((ms) => setTimeout(mark, ms))
    return () => t.forEach(clearTimeout)
  }, [looks])
  return null
}

/** Every look of one part, side by side, each named above it. `w`: each look's width (the width the page gives the
 * part); `platform`: the pointer's looks are the desktop's only (the phone has no pointer); `id`: the place on the page
 * the part sits in (#list...), which some of the page's rules look at; `setup`: the demo's data as the looks need it. */
export function looks(
  list: Look[],
  {
    w = 'w-[420px]',
    platform = 'desktop',
    id,
    setup,
  }: {
    w?: string
    platform?: 'desktop' | 'phone' | 'both'
    id?: string
    setup?: (x: Setup) => void
  } = {},
): StoryObj {
  const pseudo = {
    hover: list.flatMap((l, i) => at(i, l.hover)),
    focusVisible: list.flatMap((l, i) => at(i, l.focus)),
    focusWithin: list.flatMap((l, i) => at(i, l.within)),
    active: list.flatMap((l, i) => at(i, l.active)),
  }
  // in the globals too, so the addon has nothing to change and the story draws once
  return {
    parameters: { platform, pseudo, taska: { setup } },
    globals: { pseudo },
    render: () => (
      <div id={id} className="flex flex-wrap items-start gap-x-8 gap-y-6 p-6">
        {list.map((l, i) => (
          <section key={i} className={`${w} max-w-full`}>
            <h3 className="mb-2 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">{l.name}</h3>
            <div data-look={i}>{l.draw()}</div>
          </section>
        ))}
        <Marks looks={list} />
      </div>
    ),
  }
}

/** The page's one tip, shown for what `sel` finds as pointing at it shows it (lib/events.ts tipShow): its words, its
 * key, a code's card. The desktop only, as the phone has no pointer. */
export function TipOn({ sel }: { sel: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(sel)
      if (el) tipShow(el, true)
    }, 400)
    return () => clearTimeout(t)
  }, [sel])
  return <Tip />
}
/** A part with the tip of what `sel` finds shown, as pointing at it shows it. */
export const tipOn = (draw: () => ReactNode, sel: string, setup?: StoryObj['parameters']): StoryObj => ({
  parameters: { platform: 'desktop', ...setup },
  render: () => (
    <>
      {draw()}
      <TipOn sel={sel} />
    </>
  ),
})
