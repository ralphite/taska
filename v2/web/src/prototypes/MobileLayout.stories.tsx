// T456 (D75): a prototype of a new phone layout, to look at before anything is built. The real page (the Storybook
// demo project) on an iPhone-sized screen, with a bar at the bottom by the levels: Projects, Items, Comments (a
// project holds items, an item holds its comments); no Needs you. An opened item is two pages: its detail under
// Items, its talk under Comments.
// The voice version (#6226) has five equal places with the voice button in the very middle, two on each side, as
// TikTok's or Instagram's bar has its main button: Projects, Items, voice, Comments, Search. The lists have no box:
// the voice button records at once, and the page's own box comes up over the bar while it does (as the keyboard
// covers the bar when you type): a new input on a list, a reply in an opened item. Search listens at once (F479).
// The page's menu and search buttons at the top go: the bar has them.
// What is not built yet is drawn on the page (the bar, the line saying where the words go); everything else is the
// page's own. It plays itself (R488: a big mark where it taps, a person's pace, a line under the screen); with
// Autoplay off you tap the marked place yourself. Nothing here changes Taska itself.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Ctx, type Script } from '../stories/lib/player'
import { Icon } from '../components/ui'
import type { IconName } from '../lib/icons'
import { OnPage, wait } from './lib/onPage'
import { ListenPanel, Results, VoiceSearch } from './lib/voiceSearch'

const meta: Meta = {
  title: 'Prototype/New mobile layout',
  // the frame fits the room Storybook has, with what is said under it in sight: no fixed preview size around it
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
}
export default meta

type Tab = 'Projects' | 'Items' | 'Comments' | 'Search'
type Place = 'items' | 'detail' | 'comments' | 'inputs' | 'projects' | 'search'
const TAB_OF: Record<Place, Tab> = {
  items: 'Items',
  detail: 'Items',
  comments: 'Comments',
  inputs: 'Comments',
  projects: 'Projects',
  search: 'Search',
}
const ICON_OF: Record<Tab, IconName> = { Projects: 'folder', Items: 'items', Comments: 'comment', Search: 'search' }
const BAR = 81 // the bar's height: 60 for its buttons, 20 under them (where the phone's home line is), its line

/** The bar at the bottom: three places, or five with the voice button in the middle */
function Bar({ on, count, mic, onTap }: { on: Tab; count: number; mic: boolean; onTap: (t: Tab | 'Mic') => void }) {
  const places: (Tab | 'Mic')[] = mic
    ? ['Projects', 'Items', 'Mic', 'Comments', 'Search']
    : ['Projects', 'Items', 'Comments']
  return (
    <nav
      data-proto="bar"
      className={`fixed inset-x-0 bottom-0 z-30 grid border-t border-zinc-200 bg-white/90 pb-5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 ${mic ? 'grid-cols-5' : 'grid-cols-3'}`}
    >
      {places.map((t) =>
        t === 'Mic' ? (
          <div key={t} className="grid h-15 place-items-center">
            <button
              data-tab="Mic"
              aria-label="Say something"
              onClick={() => onTap('Mic')}
              className="grid size-12 place-items-center rounded-full bg-zinc-900 text-white shadow-md shadow-zinc-900/25 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none"
            >
              <Icon n="mic" c="size-6" sw="2" />
            </button>
          </div>
        ) : (
          <button
            key={t}
            data-tab={t}
            aria-current={on === t ? 'page' : undefined}
            onClick={() => onTap(t)}
            className={`flex h-15 flex-col items-center justify-center gap-1 text-[11px] font-medium ${on === t ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`}
          >
            <Icon n={ICON_OF[t]} c="size-6" sw={on === t ? '2' : '1.75'} />
            <span>
              {t}
              {/* how many messages the open item has, as the page's tabs give their counts: a number, not a badge */}
              {t === 'Comments' && count ? (
                <span className="ml-0.5 text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500">{count}</span>
              ) : null}
            </span>
          </button>
        ),
      )}
    </nav>
  )
}

/** Over the box while the voice button's words are on their way: where they go */
const WhereTo = ({ reply }: { reply: string | null }) => (
  <div className="flex h-8 items-center gap-1.5 pl-4 text-[13px] text-zinc-500 dark:text-zinc-400">
    <Icon n={reply ? 'reply' : 'newinput'} c="size-4" />
    {reply ? (
      <>
        Reply to <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-200">{reply}</span>
      </>
    ) : (
      'New input to Shop'
    )}
  </div>
)

/** After sending: the page's line after sending (its look), over the bar now that the box has gone down */
const SentLine = ({ to, secs }: { to: string; secs: number | null }) => (
  <div
    role="status"
    className="fixed inset-x-3 z-30 flex min-h-8 items-center gap-2 rounded-full bg-white pr-3 pl-3 text-[13px] text-zinc-600 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"
    style={{ bottom: BAR + 8 }}
  >
    <span className="size-2 shrink-0 rounded-full bg-blue-500" />
    <span className="min-w-0 flex-1 truncate">
      Sent to <b className="font-semibold text-zinc-800 dark:text-zinc-100">{to}</b>
      {secs == null ? null : `: voice note 0:${String(secs).padStart(2, '0')}`}
    </span>
  </div>
)

/** The new layout on the real page: its places, the bar's taps, the voice button, search */
function setUp(doc: Document, mic: boolean) {
  const p = new OnPage(doc)
  const S = { place: 'items' as Place, writing: 0, path: p.path(), busy: 0 }
  const ground = { bg: '', line: '' } // the page's ground and the bar's line, light or dark, read once drawn
  let sent: { to: string; secs: number | null } | null = null
  let sending: 'voice' | 'words' | null = null // the box's send was tapped (not its X): a voice note, or words
  let sentAt = 0 // when: the box stays a moment after it, so the finger lifts before the bar comes back
  doc.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element).closest?.('#foot [data-act="rec-send"], #foot [data-act="send"]')
      if (b) {
        sending = b.getAttribute('data-act') === 'send' ? 'words' : 'voice'
        sentAt = Date.now()
      }
    },
    true,
  )
  const vs = new VoiceSearch(p, () => look())
  const counts = new Map<number, number>(),
    titles = new Map<number, string>()
  void p.win
    .fetch('/p/shop/api/state?since=0')
    .then((r) => r.json())
    .then((s: { items: { n: number; title: string; thread?: unknown[] }[] }) => {
      for (const it of s.items) {
        counts.set(it.n, it.thread?.length || 0)
        titles.set(it.n, it.title)
      }
      look()
    })
  const openN = () => {
    const m = /\/[A-Z](\d+)$/.exec(p.path())
    return m ? Number(m[1]) : null
  }
  const code = () => {
    const m = /\/([A-Z])(\d+)$/.exec(p.path())
    return m ? m[1] + m[2].padStart(2, '0') : null // F1 is F01, as the page writes it
  }
  const whereTo = p.slot(p.$('#foot')?.firstElementChild as HTMLElement | null)
  // on its Comments page, which item it is: its title under the page's head
  const whichItem = p.slot(p.$('#detailBody'))
  /** the page as this place shows it */
  const look = () => {
    const place = S.place,
      writing = !!S.writing
    p.undo()
    p.set(p.$('#tabs'), { display: 'none' }) // Items / Inputs / Rules: the bar has them
    p.set(p.$('#projBtn #logo')?.parentElement || null, { display: 'none' }) // the menu: Projects is in the bar
    p.set(p.$('#projBtn'), { pointerEvents: 'none' })
    if (mic) p.set(p.$('#searchBtn'), { display: 'none' }) // Search is in the bar
    if (place === 'projects') {
      p.set(p.$('#drawer'), { width: '100%', maxWidth: 'none', transform: 'none', paddingBottom: BAR + 12 + 'px' })
      p.set(p.$('#drawerShade'), { display: 'none' })
      p.set(p.$('#app'), { visibility: 'hidden' })
    }
    if (place === 'detail') p.set(p.$('#itemTalk'), { display: 'none' })
    if (place === 'comments') p.set(p.$('#itemTop'), { display: 'none' })
    // where you write: the box is under Comments (and on the lists without the voice button); the voice button
    // brings it up anywhere while its words are on their way
    const box = writing || (!mic && (place === 'comments' || place === 'items' || place === 'inputs'))
    if (!box) p.set(p.$('#foot'), { display: 'none' })
    // over the bar's place the box stands on the page's own ground, with the bar's line over it
    if (writing && mic) p.set(p.$('#foot'), { background: ground.bg, borderTop: `1px solid ${ground.line}` })
    p.set(p.$('#app'), { paddingBottom: writing ? '0px' : BAR + 'px' })
    whereTo(writing ? <WhereTo reply={openN() ? code() : null} /> : null)
    const item = openN()
    whichItem(
      place === 'comments' && item ? (
        <p className="shrink-0 truncate border-b border-zinc-100 px-4 py-2 text-[13px] font-medium text-zinc-600 dark:border-zinc-800/70 dark:text-zinc-300">
          {titles.get(item)}
        </p>
      ) : null,
    )
    const n = openN()
    p.draw(
      <>
        {writing ? null : (
          <Bar
            on={TAB_OF[place]}
            count={n && (place === 'detail' || place === 'comments') ? counts.get(n) || 0 : 0}
            mic={mic}
            onTap={(t) => void to(t)}
          />
        )}
        {place === 'search' && vs.rows ? (
          <Results
            rows={vs.rows}
            desk={false}
            at={{ left: 0, top: 0, width: doc.documentElement.clientWidth, bottom: BAR }}
            open={null}
            onAgain={() => void vs.ask()}
            onCancel={() =>
              void (async () => {
                vs.cancel()
                await p.go('/p/shop/')
                show('items')
              })()
            }
          />
        ) : null}
        {sent && !writing ? <SentLine to={sent.to} secs={sent.secs} /> : null}
        {vs.phase ? (
          <ListenPanel phase={vs.phase} words={vs.words} onClose={() => vs.close()} onFinish={() => vs.finish()} />
        ) : null}
      </>,
    )
  }
  const show = (place: Place) => {
    S.place = place
    S.path = p.path()
    look()
    if (place === 'comments') {
      const b = p.$('#detailBody')
      if (b) b.scrollTop = b.scrollHeight
    }
  }
  const leaveProjects = async () => {
    if (S.place !== 'projects') return
    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wait(150)
  }
  /** a tap on the bar, by you or the walkthrough */
  const to = async (t: Tab | 'Mic') => {
    S.busy++
    try {
      await go(t)
    } finally {
      S.busy--
    }
  }
  const go = async (t: Tab | 'Mic') => {
    const open = openN() != null
    if (t !== 'Search' && t !== 'Mic') vs.cancel()
    if (t === 'Projects') {
      if (S.place !== 'projects') p.$('#projBtn')?.click()
      await wait(100)
      return show('projects')
    }
    if (t === 'Search') {
      // it listens over the page you are on (the bar dimmed under it); what it finds is Search's page
      void vs.ask()
      return void vs.until('found').then(() => {
        // Search's page at once (before the next frame), then the projects page closes under it
        const projects = S.place === 'projects'
        show('search')
        if (projects) doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
    }
    await leaveProjects()
    if (t === 'Comments') {
      if (open) return show('comments')
      await p.go('/p/shop/inputs')
      return show('inputs')
    }
    if (t === 'Items') {
      // in an opened item: its detail; on its detail already, back to the list
      if (open && S.place !== 'detail') return show('detail')
      await p.go('/p/shop/')
      return show('items')
    }
    // the voice button: words for where you are; in an item they are a reply, on its Comments page
    if (S.place === 'search') {
      vs.cancel()
      await p.go('/p/shop/')
      show('items')
    }
    if (S.place === 'projects') show('items')
    if (S.place === 'detail') show('comments')
    S.writing = Date.now()
    look()
    p.$('#foot [data-act="mic"]')?.click()
  }
  // you went somewhere on the page yourself (opened an item, its Back): the screen and the bar follow; the box goes
  // down once its words are sent or let go
  const t = window.setInterval(() => {
    if (!doc.defaultView) return clearInterval(t)
    if (S.writing && Date.now() - S.writing > 1200) {
      const text = p.$('#text') as HTMLTextAreaElement | null
      const busy = !!p.$('#recBar:not([hidden])') || !!text?.value.trim() || !!p.$('#foot [data-act="unfile"]')
      if (!busy && Date.now() - sentAt > 800) {
        if (sending) {
          const shown = (sent = {
            to: code() || 'Shop',
            secs: sending === 'voice' ? Math.max(1, Math.round((Date.now() - S.writing) / 1000) - 1) : null,
          })
          setTimeout(() => {
            if (sent === shown) sent = null
            look()
          }, 3500)
        }
        sending = null
        S.writing = 0
        look()
      }
    }
    const path = p.path()
    if (path === S.path || S.busy || S.place === 'projects') return
    if (openN() != null) show(S.place === 'comments' ? 'comments' : 'detail')
    else if (/\/inputs$/.test(path)) show('inputs')
    else show(vs.rows ? 'search' : 'items')
  }, 150)
  look()
  const drawn = doc.querySelector<HTMLElement>('[data-proto="bar"]')
  const app = p.$('#app')
  if (drawn && app)
    Object.assign(ground, { bg: getComputedStyle(app).backgroundColor, line: getComputedStyle(drawn).borderTopColor })
  return { vs, bar: (t: Tab | 'Mic') => doc.querySelector<HTMLElement>(`[data-proto="bar"] [data-tab="${t}"]`) }
}

const play =
  (mic: boolean): Script =>
  async (c: Ctx) => {
    const { doc, say, tap, wait } = c
    const { vs, bar } = setUp(doc, mic)
    c.show()
    const row = () => doc.querySelector<HTMLElement>('#list [data-act="open"][data-n="1"]')
    const send = () => doc.querySelector<HTMLElement>('#foot [data-act="rec-send"]')
    const n = mic ? 9 : 5
    let i = 0
    const step = (s: string) => say(`${++i} / ${n} \u00b7 ${s}`)
    step(
      mic
        ? 'Items. The bar: Projects, Items, the voice button, Comments, Search'
        : 'Items. The bar: Projects, Items, Comments',
    )
    await wait(3500)
    if (mic) {
      step('Tap the voice button: it records at once, a new input to Shop')
      await wait(1500)
      await tap(bar('Mic'))
      await wait(3000)
      step('Tap \u2191 to send it (\u2713 stops and shows the words to edit first, \u2715 throws it away)')
      await wait(1500)
      await tap(send())
      await wait(1000)
    }
    step(mic ? 'Sent: the box goes down, the bar is back. Tap an item to open it' : 'Tap an item to open it')
    await wait(1500)
    await tap(row())
    await wait(800)
    step('Its detail: title, state, documents, subitems. Tap Comments for its talk')
    await wait(3000)
    await tap(bar('Comments'))
    await wait(800)
    if (mic) {
      step('Its talk. The voice button here replies to F01')
      await wait(3000)
      await tap(bar('Mic'))
      await wait(3000)
      step('Tap \u2191 to send the reply; the bar comes back')
      await wait(1200)
      await tap(send())
      await wait(2500)
    } else {
      step('Its talk, and the box to reply. Tap Items: back to its detail')
      await wait(3000)
      await tap(bar('Items'))
      await wait(1500)
    }
    step('Projects: every project, and Documents, Activity, Settings')
    await wait(1500)
    await tap(bar('Projects'))
    await wait(3000)
    if (mic) {
      step('Search: it listens at once, over the page you are on, and finds by meaning')
      await wait(1500)
      await tap(bar('Search'))
      await vs.until('found')
      await wait(3500)
    }
    say('That is all. Play again, or turn Autoplay off and tap the marked places yourself')
  }
const withMic = play(true),
  without = play(false)

export const TourVoiceButton: StoryObj = {
  name: 'Walkthrough \u00b7 voice button',
  parameters: {
    docs: {
      description: {
        story:
          'Projects, Items, the voice button in the middle, Comments, Search. It records a new input, opens an item, its talk, a reply, Projects, Search.',
      },
    },
  },
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={withMic} scheme={String(globals.scheme)} on="iphone" veil />
  ),
}
export const Tour: StoryObj = {
  name: 'Walkthrough \u00b7 three places',
  parameters: {
    docs: {
      description: {
        story: 'Projects, Items, Comments; the box stays where it is today. Opens an item, its talk, Projects.',
      },
    },
  },
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={without} scheme={String(globals.scheme)} on="iphone" veil />
  ),
}
