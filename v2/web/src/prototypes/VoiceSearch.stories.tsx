// F479 (D76): a prototype of search by voice, to look at before anything is built. The real page (the Storybook demo
// project) plays it, on the phone and on the desktop: tap search and a panel comes up already listening (no box to
// type in); you talk, pause, and it has heard you; the list then shows what was found by meaning, with what you said
// on top; tap one and it opens as any item does. What is not built yet is drawn on the page (lib/voiceSearch.tsx):
// the panel, the results' head, the line saying why; the rows are the page's own.
// On the desktop the search box goes: a Search button opens the same panel (or press /).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Ctx, type Script } from '../stories/lib/player'
import { Icon } from '../components/ui'
import { OnPage } from './lib/onPage'
import { ListenPanel, Results, SAID, VoiceSearch } from './lib/voiceSearch'

const meta: Meta = {
  title: 'Prototype/Voice search',
  // the frame fits the room Storybook has, with what is said under it in sight: no fixed preview size around it
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
}
export default meta

type Box = { left: number; top: number; width: number; bottom: number }
const box = (el: HTMLElement | null): Box | null => {
  const r = el?.getBoundingClientRect()
  return r ? { left: r.left, top: r.top, width: r.width, bottom: 0 } : null
}

/** The search by voice on the real page: its parts drawn, its taps and keys heard */
function setUp(doc: Document, desk: boolean) {
  const p = new OnPage(doc)
  let open: number | null = null
  const vs = new VoiceSearch(p, () => draw())
  // the desktop: each search box gives its place to a Search button (no box): the list's, and the one over what you
  // said on the New input page
  const field = desk ? p.$('#headSearch label') : null,
    said = desk ? (p.$('#saidQ')?.closest('label') as HTMLElement | null) : null
  const list = desk ? box(p.$('#mainHead')) : { left: 0, top: 0, width: doc.documentElement.clientWidth, bottom: 0 }
  const fieldSlot = p.slot(field),
    saidSlot = p.slot(said)
  p.set(field, { display: 'none' })
  p.set(said, { display: 'none' })
  // an icon button, as the filter button beside it and the phone's search: nothing that looks like a box
  const button = (label: string) => (
    <button
      data-proto-act="search"
      onClick={() => void vs.ask()}
      aria-label={label}
      title={`${label} by voice \u00b7 /`}
      className="ml-auto grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <Icon n="search" c="size-[18px]" />
    </button>
  )
  fieldSlot(button('Search'))
  saidSlot(button('Search what you said'))
  const draw = () =>
    p.draw(
      <>
        {vs.rows && list && (desk || open == null) ? (
          <Results
            rows={vs.rows}
            desk={desk}
            at={list}
            open={open}
            onAgain={() => void vs.ask()}
            onCancel={() => vs.cancel()}
          />
        ) : null}
        {vs.phase ? (
          <ListenPanel phase={vs.phase} words={vs.words} onClose={() => vs.close()} onFinish={() => vs.finish()} />
        ) : null}
      </>,
    )
  // the phone: the page's own search button starts listening instead of opening a box
  p.$('#searchBtn')?.addEventListener(
    'click',
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      void vs.ask()
    },
    true,
  )
  doc.addEventListener(
    'keydown',
    (e) => {
      const typing = (e.target as Element).closest?.('input, textarea, [contenteditable]')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        e.stopImmediatePropagation()
        void vs.ask()
      } else if (e.key === 'Escape' && (vs.phase || (desk && vs.rows))) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (vs.phase) vs.close()
        else vs.cancel()
      }
    },
    true,
  )
  // an item opened (a row of the results) or left (Back): on the phone the results wait under it
  const t = window.setInterval(() => {
    if (!doc.defaultView) return clearInterval(t)
    const m = /\/[A-Z](\d+)$/.exec(p.path()),
      now = m ? Number(m[1]) : null
    if (now !== open) {
      open = now
      draw()
    }
  }, 150)
  draw()
  return vs
}

const play =
  (desk: boolean): Script =>
  async (c: Ctx) => {
    const { doc, say, tap, wait } = c
    const vs = setUp(doc, desk)
    c.show()
    const steps = desk ? 5 : 6
    say(`1 / ${steps} \u00b7 ${desk ? 'Click Search (or press /)' : 'Tap search'}: it listens at once, no box to type in`)
    await wait(2500)
    await tap(doc.querySelector<HTMLElement>(desk ? '[data-proto-act="search"]' : '#searchBtn'))
    await vs.until('speak')
    say(`2 / ${steps} \u00b7 Say what you are looking for: \u201c${SAID}\u201d`)
    await vs.until('heard')
    say(`3 / ${steps} \u00b7 You pause: it stops by itself and finds by meaning`)
    await vs.until('found')
    say(`4 / ${steps} \u00b7 What it found, the closest first; each says why`)
    await wait(4000)
    say(`5 / ${steps} \u00b7 ${desk ? 'Click' : 'Tap'} the closest to open it`)
    await wait(1500)
    await tap(doc.querySelector<HTMLElement>('[data-proto="results"] [data-act="open"]'))
    if (desk) {
      say('It opens on the right; what was found stays on the left')
      await wait(3000)
      return
    }
    await wait(1500)
    say('6 / 6 \u00b7 It opens as any item does; Back goes to what was found')
    await wait(2000)
    await tap(doc.getElementById('backBtn'))
    say('Back to what was found. Again: say it again; Cancel: back to the list')
    await wait(3000)
  }
const phone = play(false),
  desktop = play(true)

export const Phone: StoryObj = {
  parameters: {
    docs: {
      description: { story: 'Tap search: it listens at once; what was found by meaning; open one. On the phone.' },
    },
  },
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={phone} scheme={String(globals.scheme)} on="iphone" veil />
  ),
}
export const Desktop: StoryObj = {
  parameters: {
    docs: { description: { story: 'The same on the desktop: the Search button (or /) opens the panel.' } },
  },
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={desktop} scheme={String(globals.scheme)} on="desktop" veil />
  ),
}
