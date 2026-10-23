// F479 (D85): a prototype of the new search, to look at before anything is built (Yadong's r769, r770). On the real
// page (the Storybook demo project): the list keeps no search box and no filter button; a Search button sits under New
// input in the sidebar (the phone keeps its magnifier); it opens a dialog already listening; you talk, pause, and it
// finds in every project and every kind of thing, by words and by meaning, grouped by kind (All, or one kind); a click
// opens one where it is. Views (the old filters) are made in Settings. The parts not built are in lib/searchEverything.
// It replaces the earlier voice search prototype (D76).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { Player, type Ctx, type Script } from '../stories/lib/player'
import { OnPage } from './lib/onPage'
import {
  SAID,
  SearchButton,
  SearchEverything,
  SearchPanel,
  ViewsSettings,
  type Hit,
  type Shown,
} from './lib/searchEverything'

const meta: Meta = {
  title: 'Prototype/F479 Search everything',
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
}
export default meta

/** The new search on the real page: the list's search box and filter button gone, the Search button, the dialog */
function setUp(doc: Document, desk: boolean) {
  const p = new OnPage(doc)
  const se = new SearchEverything(() => draw())
  // gone: the list's search box and its filter button, the search box over what you said on the New input page
  for (const sel of ['#headSearch', '#deskFilterBtn']) p.set(p.$(sel), { display: 'none' })
  for (const el of doc.querySelectorAll<HTMLElement>('[data-act="filters"]')) p.set(el, { display: 'none' })
  p.set(p.$('#saidQ')?.closest('label') as HTMLElement | null, { display: 'none' })
  if (desk) {
    // the Search button, just under New input in the sidebar
    const ni = p.$('#newInputBtn')?.parentElement as HTMLElement | null
    p.slot(ni?.nextElementSibling as HTMLElement | null)(<SearchButton onClick={() => void se.ask()} />)
  } else {
    // the phone: its magnifier stays where it is and opens the same search
    p.$('#searchBtn')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault()
        e.stopPropagation()
        void se.ask()
      },
      true,
    )
  }
  const open = (h: Hit) => {
    se.close()
    void p.go(h.path)
  }
  const draw = () =>
    p.draw(
      se.shown ? (
        <SearchPanel
          shown={se.shown}
          words={se.words}
          pick={se.pick}
          desk={desk}
          onPick={(k) => se.setPick(k)}
          onAgain={() => void se.ask()}
          onClose={() => se.close()}
          onFinish={() => se.finish()}
          onOpen={open}
        />
      ) : null,
    )
  doc.addEventListener(
    'keydown',
    (e) => {
      const typing = (e.target as Element).closest?.('input, textarea, [contenteditable]')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        e.stopImmediatePropagation()
        void se.ask()
      } else if (e.key === 'Escape' && se.shown) {
        e.preventDefault()
        e.stopImmediatePropagation()
        se.close()
      }
    },
    true,
  )
  draw()
  return se
}

const play =
  (desk: boolean): Script =>
  async (c: Ctx) => {
    const { doc, say, tap, wait } = c
    const se = setUp(doc, desk)
    c.show()
    say(
      desk
        ? '1 / 5 \u00b7 The list has no search box or filter button now; Search is under New input (or press /)'
        : '1 / 5 \u00b7 The magnifier stays where it is; no filter button',
    )
    await wait(3000)
    await tap(doc.querySelector<HTMLElement>(desk ? '[data-proto-act="search"]' : '#searchBtn'))
    await se.until('speak')
    say(`2 / 5 \u00b7 It listens at once. Say what you are looking for: \u201c${SAID}\u201d`)
    await se.until('heard')
    say('3 / 5 \u00b7 You pause: it finds in every project, by words and by meaning')
    await se.until('found')
    say('4 / 5 \u00b7 Grouped by kind, the closest first; each says why; another project says which')
    await wait(4000)
    await tap(doc.querySelector<HTMLElement>('[data-proto-act="kind"][data-kind="doc"]'))
    say('Pick one kind to see only that kind; All shows every kind')
    await wait(2500)
    await tap(doc.querySelector<HTMLElement>('[data-proto-act="kind"][data-kind="all"]'))
    await wait(1200)
    say(`5 / 5 \u00b7 ${desk ? 'Click' : 'Tap'} one: it opens where it is`)
    await wait(1500)
    await tap(doc.querySelector<HTMLElement>('[data-proto="search"] [data-proto-act="open"]'))
    await wait(3000)
  }

export const Desktop: StoryObj = {
  name: 'Desktop: search everything',
  parameters: {
    docs: {
      description: { story: 'Prototype for F479, not built yet: the Search button under New input, the dialog.' },
    },
  },
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={play(true)} scheme={String(globals.scheme)} on="desktop" veil />
  ),
}
export const Phone: StoryObj = {
  name: 'Phone: search everything',
  parameters: {
    docs: { description: { story: 'Prototype for F479, not built yet: the magnifier opens the same search.' } },
  },
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={play(false)} scheme={String(globals.scheme)} on="iphone" veil />
  ),
}

// ---------------------------------------------------------------- every state, side by side

const Cell = ({ label, desk, children }: { label: string; desk: boolean; children: ReactNode }) => (
  <figure className="flex flex-col gap-2">
    <figcaption className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</figcaption>
    {/* a frame of its own: the dialog's fixed layer stays inside it */}
    <div
      className={`relative transform-gpu overflow-hidden rounded-xl bg-zinc-50 ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10 ${desk ? 'h-[560px] w-[760px]' : 'h-[700px] w-[393px]'}`}
    >
      {children}
    </div>
  </figure>
)
const noop = () => {}
const at = (shown: Shown, pick: 'all' | 'doc' | 'rule' = 'all', words = SAID) => ({ shown, pick, words })
const STATES: [string, ReturnType<typeof at>][] = [
  ['Listening, nothing said yet', at('listen', 'all', '')],
  ['You talk: the words come as you say them', at('speak', 'all', SAID.slice(0, 4))],
  ['You paused: finding', at('heard')],
  ['Found: All, grouped by kind', at('found')],
  ['Found: one kind picked (Documents)', at('found', 'doc')],
  ['A kind with nothing (Rules)', at('found', 'rule')],
  ['Nothing found', at('none')],
  ['No voice heard', at('silent')],
  ['The microphone is not allowed', at('nomic')],
  ['Taska cannot be reached', at('offline')],
]
const Board = ({ desk }: { desk: boolean }) => (
  <div className="flex flex-wrap gap-6 p-6">
    {STATES.map(([label, s]) => (
      <Cell key={label} label={label} desk={desk}>
        <SearchPanel
          shown={s.shown}
          words={s.words}
          pick={s.pick}
          desk={desk}
          onPick={noop}
          onAgain={noop}
          onClose={noop}
          onFinish={noop}
          onOpen={noop}
          framed
        />
      </Cell>
    ))}
  </div>
)
export const StatesDesktop: StoryObj = {
  name: 'Every state: desktop',
  render: () => <Board desk />,
}
export const StatesPhone: StoryObj = {
  name: 'Every state: phone',
  render: () => <Board desk={false} />,
}

// ---------------------------------------------------------------- views in Settings

/** a frame as tall as what it holds (a page that scrolls on the real screen) */
const Frame = ({ label, w, children }: { label: string; w: string; children: ReactNode }) => (
  <figure className="flex flex-col gap-2">
    <figcaption className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</figcaption>
    <div className={`overflow-hidden rounded-xl ring-1 ring-zinc-900/10 dark:ring-white/10 ${w}`}>{children}</div>
  </figure>
)
export const Views: StoryObj = {
  name: 'Views in Settings (the old filters)',
  parameters: {
    docs: {
      description: {
        story:
          'Prototype for F479, not built yet: a new Settings page, Views. The list has no filter button; its views are made here.',
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-start gap-6 p-6">
      <Frame label="Desktop: a view of yours open to change" w="w-[760px]">
        <div className="bg-white dark:bg-zinc-950">
          <ViewsSettings editing={0} />
        </div>
      </Frame>
      <Frame label="Phone" w="w-[393px]">
        <div className="bg-white dark:bg-zinc-950">
          <ViewsSettings />
        </div>
      </Frame>
    </div>
  ),
}
