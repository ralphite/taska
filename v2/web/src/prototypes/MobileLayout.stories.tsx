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
// T456 (#6662): a document is one level inside its item (items, an item, its document): it opens as a page pushed in
// from the right, not a sheet from the bottom; a swipe right (or its Back) goes back to the item; the bar stays, so
// any place is one tap away. A tap on a part of it picks that part (the page's own pick), and the bar's voice button
// then comments on it, in the page's own box with its own line ("Comment on D1 ..."); nothing picked, on the whole
// document.
import type { ReactNode } from 'react'
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
type Place = 'items' | 'detail' | 'doc' | 'comments' | 'inputs' | 'projects' | 'search'
const TAB_OF: Record<Place, Tab> = {
  items: 'Items',
  detail: 'Items',
  doc: 'Items',
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
const SentLine = ({ to, part, secs }: { to: string; part: string | null; secs: number | null }) => (
  <div
    role="status"
    className="fixed inset-x-3 z-30 flex min-h-9 items-center gap-2 rounded-full bg-white pr-3 pl-2.5 text-[13px] text-zinc-700 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
    style={{ bottom: BAR + 12 }}
  >
    <span className="text-emerald-600 dark:text-emerald-400">
      <Icon n="check" c="size-4" sw="2.5" />
    </span>
    <span className={`${part ? 'shrink-0' : 'min-w-0 truncate'}`}>
      {to.startsWith('D') ? 'Comment sent on ' : 'Sent to '}
      <b className="font-semibold text-zinc-800 dark:text-zinc-100">{to}</b>
      {part || !to.startsWith('D') ? null : ' \u00b7 whole document'}
      {/* a comment on a document says where it went; a note anywhere else, how long it was */}
      {part || secs == null || to.startsWith('D') ? null : ` \u00b7 voice note 0:${String(secs).padStart(2, '0')}`}
    </span>
    {/* the part it is on, word for word as the box's line said it; then no length, there is no room for both */}
    {part ? <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">{`\u201c${part}\u201d`}</span> : null}
  </div>
)

/** The new layout on the real page: its places, the bar's taps, the voice button, search */
function setUp(doc: Document, mic: boolean) {
  const p = new OnPage(doc)
  const S = { place: 'items' as Place, writing: 0, path: p.path(), busy: 0, keptDoc: null as number | null }
  const ground = { bg: '', line: '' } // the page's ground and the bar's line, light or dark, read once drawn
  let sent: { to: string; part: string | null; secs: number | null } | null = null
  let sentPart: string | null = null // the part of a document the comment is on, as the box's line said it
  let sending: 'voice' | 'words' | null = null // the box's send was tapped (not its X): a voice note, or words
  let sentAt = 0 // when: the box stays a moment after it, so the finger lifts before the bar comes back
  let heldFor: number | null = null // how long the voice note was, as the box showed it
  doc.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element).closest?.('#foot [data-act="rec-send"], #foot [data-act="send"]')
      if (b) {
        sending = b.getAttribute('data-act') === 'send' ? 'words' : 'voice'
        sentAt = Date.now()
        const m = /(\d+):(\d+)/.exec(p.$('#recTime')?.textContent || '')
        heldFor = m ? Number(m[1]) * 60 + Number(m[2]) : null
        sentPart = /\u201c(.+?)\u201d/.exec(p.$('#scope')?.textContent || '')?.[1] || null
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
  // the open document (its address is /p/shop/D1), and the item it is in, kept from when it was opened
  const docN = () => {
    const m = /\/D(\d+)$/.exec(p.path())
    return m ? Number(m[1]) : null
  }
  const item = { n: null as number | null, code: '' }
  const openN = () => {
    if (docN() != null) return item.n
    const m = /\/[A-CE-Z](\d+)$/.exec(p.path())
    return m ? Number(m[1]) : null
  }
  const code = () => {
    const d = docN()
    if (d != null) return 'D' + d
    const m = /\/([A-CE-Z])(\d+)$/.exec(p.path())
    return m ? m[1] + m[2].padStart(2, '0') : null // F1 is F01, as the page writes it
  }
  const itemCode = () => item.code
  const whereTo = p.slot(p.$('#foot')?.firstElementChild as HTMLElement | null)
  // on its Comments page, which item it is: its title under the page's head
  const whichItem = p.slot(p.$('#detailBody'))
  // the box grows when its words start (its line, its words): the document ends where the box begins, at once
  const Grows = (p.win as Window & { ResizeObserver: typeof ResizeObserver }).ResizeObserver
  const foot0 = p.$('#foot')
  if (foot0) new Grows(() => S.place === 'doc' && S.writing && docPage(true)).observe(foot0)
  let backSlot: ((node: ReactNode) => void) | null = null
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
    if (place === 'detail' || place === 'doc') p.set(p.$('#itemTalk'), { display: 'none' }) // the doc is over the detail
    if (place === 'doc') docPage(writing)
    if (place === 'comments') p.set(p.$('#itemTop'), { display: 'none' })
    // where you write: the box is under Comments (and on the lists without the voice button); the voice button
    // brings it up anywhere while its words are on their way
    const box = writing || (!mic && (place === 'comments' || place === 'items' || place === 'inputs'))
    if (!box) p.set(p.$('#foot'), { display: 'none' })
    // over the bar's place the box stands on the page's own ground, with the bar's line over it
    if (writing && mic) p.set(p.$('#foot'), { background: ground.bg, borderTop: `1px solid ${ground.line}` })
    p.set(p.$('#app'), { paddingBottom: writing ? '0px' : BAR + 'px' })
    // in a document the box says itself where the words go (the page's own line: Comment on D1 ...)
    whereTo(writing && place !== 'doc' ? <WhereTo reply={openN() ? code() : null} /> : null)
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
            count={n && (place === 'detail' || place === 'comments' || place === 'doc') ? counts.get(n) || 0 : 0}
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
        {sent && !writing ? <SentLine to={sent.to} part={sent.part} secs={sent.secs} /> : null}
        {vs.phase ? (
          <ListenPanel phase={vs.phase} words={vs.words} onClose={() => vs.close()} onFinish={() => vs.finish()} />
        ) : null}
      </>,
    )
  }
  /** The page's document sheet as a page of its own: from the top to the bar (or the box), no handle, no shadow; its
   * way back first in its head, as the item page's */
  const docPage = (writing: boolean) => {
    const overlay = p.$('#overlay'),
      dlg = p.$('#dlg')
    if (!overlay || !dlg) return
    const foot = p.$('#foot')
    p.set(foot, { display: writing ? '' : 'none' })
    const under = writing && foot ? foot.offsetHeight : BAR
    p.set(overlay, {
      bottom: under + 'px',
      padding: '0',
      background: 'transparent',
      alignItems: 'stretch',
      zIndex: '25',
    })
    // its left edge casts a shadow on the item it slides over (seen only while it moves)
    p.set(dlg, {
      maxHeight: 'none',
      height: '100%',
      maxWidth: 'none',
      borderRadius: '0',
      // on black a shadow does not show: a thin light edge does
      boxShadow:
        doc.documentElement.dataset.theme === 'dark'
          ? '-1px 0 0 rgba(255,255,255,0.14), -12px 0 28px rgba(0,0,0,0.5)'
          : '-12px 0 28px rgba(0,0,0,0.28)',
    })
    p.set(dlg.querySelector<HTMLElement>('[data-handle]'), { display: 'none' })
    const head = dlg.querySelector<HTMLElement>(':scope > header')
    p.set(head, { display: 'none' })
    if (head && !head.previousElementSibling?.hasAttribute('data-proto-slot')) backSlot = p.slot(head)
    backSlot?.(
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-100 px-1 dark:border-zinc-800/70">
        <button
          data-proto-act="doc-back"
          aria-label={`Back to ${itemCode()}`}
          onClick={() => void back()}
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 dark:text-zinc-400"
        >
          <Icon n="left" c="size-6" sw="2" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <span className="font-mono text-sm font-bold text-blue-700 dark:text-blue-300">{code()}</span>
          <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            in {itemCode()}
          </span>
        </div>
        <span className="size-11 shrink-0" />
      </header>,
    )
    // a tap picks the part (the page's own pick); what to say about it is the bar's voice button, not a row under it
    for (const say of doc.querySelectorAll<HTMLElement>('#dlg [data-act="doc-say"]'))
      if (say.parentElement) say.parentElement.style.display = 'none'
  }
  /** the document goes back out to the right, to its item */
  const back = async () => {
    const dlg = p.$('#dlg')
    if (S.place !== 'doc' || !dlg) return
    S.busy++
    try {
      slide(at) // from where it is (a swipe may have moved it): the item under it a little to the left
      void dlg.offsetWidth
      slide(W, 260, 'ease-in')
      await wait(270)
      shade.style.opacity = '0'
      p.$('#dlgClose')?.click()
      for (let i = 0; i < 40 && docN() != null; i++) await wait(25)
      show('detail')
    } finally {
      S.busy--
    }
  }
  // the item darkens a little while the document slides over it
  const shade = doc.createElement('div')
  shade.setAttribute('aria-hidden', 'true')
  Object.assign(shade.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '24',
    background: '#000',
    opacity: '0',
    pointerEvents: 'none',
  })
  doc.body.append(shade)
  const W = doc.documentElement.clientWidth
  let at = 0 // where the document is now: 0 in place, W gone
  /** the document at x (0: in place, W: gone), the item under it as dark as it is covered; ms: how long to get there */
  const slide = (x: number, ms = 0, ease = 'ease-out') => {
    const dlg = p.$('#dlg')
    if (!dlg) return
    at = x
    const t = ms ? `${ms}ms ${ease}` : 'none'
    dlg.style.transition = ms ? `transform ${t}` : 'none'
    shade.style.transition = ms ? `opacity ${t}` : 'none'
    dlg.style.transform = `translateX(${x}px)`
    // in the dark the item under it needs more shade to sit behind (a shadow does not show on black)
    const deep = doc.documentElement.dataset.theme === 'dark' ? 0.45 : 0.18
    shade.style.opacity = String(x >= W ? 0 : deep * (1 - x / W))
    // the item's page (not the whole page: the page itself sets that one's place on every draw)
    const under = p.$('#detailView')
    if (under) {
      under.style.transition = ms ? `transform ${t}` : 'none'
      under.style.transform = x >= W ? '' : `translateX(${-0.3 * (W - x)}px)`
    }
  }
  /** in place: nothing under it shows, so nothing under it is moved (the box under it stays where it is) */
  const rest = () => {
    shade.style.opacity = '0'
    const under = p.$('#detailView')
    if (under) Object.assign(under.style, { transition: 'none', transform: '' })
  }
  /** the document comes in from the right, over its item */
  const pushIn = () => {
    slide(W)
    void p.$('#dlg')?.offsetWidth
    slide(0, 320, 'cubic-bezier(.2,.8,.2,1)')
    setTimeout(rest, 340)
  }
  /** a swipe right from the left edge: the page follows the finger; far enough and it goes back */
  doc.addEventListener('pointerdown', (e) => {
    const dlg = p.$('#dlg')
    if (S.place !== 'doc' || !dlg || e.clientX > 40 || !dlg.contains(e.target as Node)) return
    const x0 = e.clientX
    let dx = 0
    const move = (m: PointerEvent) => {
      dx = Math.max(0, m.clientX - x0)
      slide(dx)
    }
    const up = () => {
      doc.removeEventListener('pointermove', move)
      doc.removeEventListener('pointerup', up)
      // a swipe is not a tap: the part under the finger is not picked by it
      if (dx > 8) {
        const eat = (c: Event) => {
          c.stopPropagation()
          c.preventDefault()
        }
        doc.addEventListener('click', eat, { capture: true, once: true })
        setTimeout(() => doc.removeEventListener('click', eat, { capture: true }), 400)
      }
      if (dx > 100) return void back()
      slide(0, 200)
      setTimeout(rest, 220)
    }
    doc.addEventListener('pointermove', move)
    doc.addEventListener('pointerup', up)
  })
  // the page opened a document (a tap on its card): a page pushed in, before the sheet it draws is ever seen
  // the page's sheet sets its own room again when it draws (its padding, its height): before each frame the document
  // gets the page's room back, so no frame shows it as a sheet
  const keep = () => {
    if (!doc.defaultView) return
    const o = p.$('#overlay')
    if (S.place === 'doc' && o && (o.style.paddingTop !== '0px' || !o.style.bottom)) docPage(!!S.writing)
    p.win.requestAnimationFrame(keep)
  }
  p.win.requestAnimationFrame(keep)
  let opening = false
  new MutationObserver(() => {
    // the sheet is drawn before the address changes: the tap on the card says it is a document
    if (S.place === 'doc' || !p.$('#dlg') || (docN() == null && !opening)) return
    opening = false
    show('doc')
  }).observe(doc.body, { childList: true, subtree: true })
  doc.addEventListener(
    'click',
    (e) => {
      if (!(e.target as Element).closest?.('[data-act="doc-open"]')) return
      Object.assign(item, { n: openN(), code: code() })
      opening = true
    },
    true,
  )
  const show = (place: Place) => {
    const into = place === 'doc' && S.place !== 'doc'
    S.place = place
    S.path = p.path()
    look()
    if (into) pushIn() // a document comes in from the right, whoever opened it
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
    if (S.place === 'doc' && t === 'Items') return back()
    if (S.place === 'doc' && t !== 'Mic' && t !== 'Search') {
      S.keptDoc = docN()
      p.$('#dlgClose')?.click()
      for (let i = 0; i < 40 && docN() != null; i++) await wait(25)
      show('detail')
    }
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
    if (t === 'Items' && S.keptDoc != null && open && S.place !== 'detail') {
      // the document you left for its talk: Items is where it is, as you left it
      show('detail')
      const card = p.$(`#itemTop [data-act="doc-open"][data-d="${S.keptDoc}"]`) || p.$('#itemTop [data-act="doc-open"]')
      card?.click()
      S.keptDoc = null
      return
    }
    if (t === 'Items') {
      S.keptDoc = null
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
    if (S.place === 'doc') docPage(!!S.writing) // the page draws the document again (a pick, a thread): it stays a page
    if (S.writing && Date.now() - S.writing > 1200) {
      const text = p.$('#text') as HTMLTextAreaElement | null
      const busy = !!p.$('#recBar:not([hidden])') || !!text?.value.trim() || !!p.$('#foot [data-act="unfile"]')
      if (!busy && Date.now() - sentAt > 800) {
        if (sending) {
          const shown = (sent = {
            to: code() || 'Shop',
            part: docN() != null ? sentPart : null,
            secs: sending === 'voice' ? heldFor : null,
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
    if (docN() != null) show('doc')
    else if (openN() != null) show(S.place === 'comments' ? 'comments' : 'detail')
    else if (/\/inputs$/.test(path)) show('inputs')
    else show(vs.rows ? 'search' : 'items')
  }, 150)
  if (openN() != null) S.place = 'detail' // a story that starts in an item
  look()
  const drawn = doc.querySelector<HTMLElement>('[data-proto="bar"]')
  const app = p.$('#app')
  if (drawn && app)
    Object.assign(ground, { bg: getComputedStyle(app).backgroundColor, line: getComputedStyle(drawn).borderTopColor })
  /** the walkthrough's swipe: a finger at the left edge, moving right, the page with it */
  const swipe = async (mark: (x: number, y: number, on: boolean) => void) => {
    const dlg = p.$('#dlg')
    if (!dlg) return
    const y = 420
    mark(24, y, true)
    await wait(700)
    S.busy++
    for (let x = 0; x <= 230; x += 10) {
      slide(x)
      mark(24 + x, y, true)
      await wait(16)
    }
    mark(254, y, false)
    S.busy--
    await back()
  }
  return {
    vs,
    swipe,
    place: () => S.place,
    bar: (t: Tab | 'Mic') => doc.querySelector<HTMLElement>(`[data-proto="bar"] [data-tab="${t}"]`),
  }
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

// T456 (#6662): a document inside its item: open it, pick a part, say a comment on it with the bar's voice button,
// swipe back to the item; the bar stays all the way
const docTour: Script = async (c: Ctx) => {
  const { doc, say, tap, wait } = c
  const { swipe, place, bar } = setUp(doc, true)
  c.show()
  const send = () => doc.querySelector<HTMLElement>('#foot [data-act="rec-send"]')
  const n = 6
  let i = 0
  const step = (s: string) => say(`${++i} / ${n} \u00b7 ${s}`)
  step('F01 is open. Its document is one level inside it: tap the document')
  await wait(3500)
  await tap(doc.querySelector<HTMLElement>('#itemTop [data-act="doc-open"]'))
  await wait(600)
  step('It opens as a page inside the item, from the right. The bar stays')
  await wait(3500)
  step('Tap a part to pick it: nothing else comes up')
  await wait(1500)
  // the conclusion's paragraph: a part with talk on it already
  const part = [...doc.querySelectorAll<HTMLElement>('#dlg [data-act="doc-pick"]')][1]
  await tap(part?.querySelector<HTMLElement>('[data-block]') || part)
  await wait(1200)
  step('Tap the voice button: you say your comment on that part')
  await wait(2000)
  await tap(bar('Mic'))
  await wait(3500)
  step('Tap \u2191: it goes on that part, and its talk opens there')
  await wait(1500)
  await tap(send())
  await wait(3000)
  step('Swipe right from the left edge: back to the item')
  await wait(2000)
  if (c.auto()) {
    // the finger: the page's tap mark, moved along the swipe
    const m = doc.getElementById('demoTap')
    await swipe((x, y, on) => {
      if (!m) return
      Object.assign(m.style, { left: x + 'px', top: y + 'px', opacity: on ? '1' : '0' })
    })
  } else {
    // you: swipe from the left edge yourself, or tap its Back
    for (let k = 0; k < 2400 && place() === 'doc'; k++) await wait(100)
  }
  await wait(2500)
  say('That is all. Play again, or turn Autoplay off and do it yourself')
}

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
export const TourDocument: StoryObj = {
  name: 'Walkthrough \u00b7 document',
  parameters: {
    docs: {
      description: {
        story:
          "An item's document opens as a page inside it, the bar staying; a tap picks a part, the voice button comments on it, a swipe right goes back.",
      },
    },
  },
  render: (_, { globals }) => (
    <Player path="/p/shop/F1" script={docTour} scheme={String(globals.scheme)} on="iphone" veil />
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
