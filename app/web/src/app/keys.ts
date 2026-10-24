// The keys, for the whole page. On the desktop a single key acts while you are not typing: J and K walk the list,
// G then I N A R the tabs, / the search, and the item's keys (A the next step, D Done, W Won't do, L Later, E
// Archive, 1-9 a choice, Cmd-Enter the answer). Esc steps back one level, on the phone too. A key that cannot act
// where you are says why, in a few words.

import { canDone, closed } from '../model/items'
import { choiceMulti, hasChoices } from '../model/markdown'
import { codeOf, liveN } from '../model/project'
import type { Item } from '../model/types'
import type { Tab } from '../model/words'
import { copyText, forAgent } from './clipboard'
import type { App } from './createApp'

const typingIn = (el: Element | null) => /INPUT|TEXTAREA|SELECT/.test(el?.tagName || '') || !!(el as HTMLElement | null)?.isContentEditable
const ITEM_KEYS = 'arndwle.sptmiCDA' // the keys that act on the open item

export function pageKeys(app: App): (e: KeyboardEvent) => void {
  let gAt = 0
  let arm: { k: string; n: number; t: number } | null = null
  const say = (words: string) => app.toasts.show(words)
  const here = () => {
    const r = app.stores.route.getState().route
    return r.page === 'project' ? r : null
  }

  const escape = (e: KeyboardEvent, active: Element | null) => {
    const r = here()
    if (!r) return
    const layers = app.stores.route.getState().layers
    if (layers.includes('drawer')) return app.nav.drawer(false)
    if (app.stores.sheet.getState().spec) return app.sheets.close()
    const view = app.stores.itemView.getState()
    if (view.subFor != null && typingIn(active)) return view.setSubFor(null)
    if (view.editing != null) return view.setEditing(null)
    if (app.desk()) {
      if (app.fields.focused('search')) {
        if (r.list.q) app.nav.setList({ q: '' })
        return app.fields.get('search')?.blur()
      }
      if (typingIn(active)) return (active as HTMLElement).blur()
      if (app.stores.route.getState().full) return app.nav.full(false)
      if (r.list.q) return app.nav.setList({ q: '' })
      if (r.place.kind === 'item' && r.tab !== 'inputs') return app.nav.closeItem()
      return
    }
    if (layers.includes('search') && app.fields.focused('search')) return app.nav.search(false)
    if (r.place.kind === 'item' && !typingIn(active)) return app.nav.closeItem()
    void e
  }

  const itemKey = (e: KeyboardEvent, it: Item, slug: string) => {
    const m = app.model(slug)
    if (!m) return
    const n = it.n
    const code = codeOf(m, n)
    const act = () => e.preventDefault()
    const status = (v: string) => (act(), void app.items.change(n, 'status', v))
    const ruleTo = (v: string) => (it.status === v ? say(`${code} is ${v === 'open' ? 'active' : 'retired'} already`) : status(v))
    switch (e.key) {
      case 'a':
        if (it.status === 'review') return status('done')
        if (it.status === 'proposed') return status('open')
        if (it.wait?.kind === 'ask' && hasChoices(it.wait.text)) return act()
        if (it.wait) return (act(), app.fields.focus('box'))
        return say(`Nothing waits on you in ${code}`)
      case 'r':
        return (act(), app.fields.focus('box'))
      case 'n':
        if (it.status === 'review') return (act(), void app.items.change(n, 'status', 'doing', { said: 'is back in progress' }))
        return say('Not yet works on items in review')
      case 'd':
        if (it.type === 'rule') return ruleTo('open')
        if (closed(it.status)) return say(`${code} is ${it.status === 'done' ? 'done' : "marked won't do"} already`)
        if (!canDone(it)) return say(it.status === 'proposed' ? `Approve ${code} first (A)` : `Accept ${code} first (A)`)
        return status('done')
      case 'w':
        if (it.type === 'rule') return ruleTo('dropped')
        if (it.status === 'dropped') return say(`${code} is marked won't do already`)
        return status('dropped')
      case 'l':
        if (it.type !== 'rule' && !closed(it.status)) return (act(), void app.items.change(n, 'when', it.when === 'now' ? 'later' : 'now'))
        return say(it.type === 'rule' ? 'Rules have no Later' : 'Later works on open items')
      case 'e':
        act()
        void app.items.change(n, 'archived', !it.archived, { note: it.archived ? '' : 'Find it under Archive' })
        if (!it.archived) app.nav.closeItem()
        return
      case 'i':
        return (act(), app.stores.itemView.getState().setEditing(n))
      case '.':
        return (act(), app.sheets.open('menu-desk', { n }, { pop: true, focus: false }))
      case 'm':
        return (act(), app.sheets.open('move', { n }, { pop: true, focus: false }))
      case 'C':
        act()
        return void copyText(forAgent(it, code, m.facts.base)).then(() => say('Copied'))
      case 'A':
        return (act(), app.stores.itemView.getState().setSubFor(n))
      case 's':
      case 'p':
      case 't':
        act()
        arm = { k: e.key, n, t: Date.now() }
        return say(({ s: 'Status: 1–6', p: 'Priority: 0–3', t: 'Type: F B I T R' } as Record<string, string>)[e.key])
    }
    if (/^[1-9]$/.test(e.key) && it.wait?.kind === 'ask') {
      const i = Number(e.key) - 1
      if (i < app.answers.labels(it).length) {
        act()
        app.answers.pick(it, i, choiceMulti(it.wait.text, i))
      }
    }
  }

  const armed = (e: KeyboardEvent, it: Item) => {
    const a = arm
    arm = null
    if (!a || a.n !== it.n || Date.now() - a.t > 3000) return false
    const STATUSES = it.type === 'rule' ? ['proposed', 'open', 'dropped'] : ['proposed', 'open', 'doing', 'review', 'done', 'dropped']
    const TYPES: Record<string, string> = { f: 'feature', b: 'bug', i: 'idea', t: 'task', r: 'rule' }
    const [f, v] =
      a.k === 'p' ? ['pri', /^[0-3]$/.test(e.key) && 'P' + e.key] : a.k === 't' ? ['type', TYPES[e.key.toLowerCase()]] : ['status', /^[1-9]$/.test(e.key) && STATUSES[Number(e.key) - 1]]
    if (!v) return false
    e.preventDefault()
    void app.items.change(it.n, f as string, v)
    return true
  }

  return (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const active = document.activeElement
    // the home page: Cmd-K or / go to its search (Esc there clears it)
    if (app.stores.route.getState().route.page === 'home') {
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typingIn(active))) {
        e.preventDefault()
        app.fields.focus('home')
      }
      return
    }
    if (e.key === 'Escape') return escape(e, active)
    // Cmd-K anywhere on the desktop, even while typing: Go to or do (again: closes it)
    if (app.desk() && (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      const open = app.stores.sheet.getState().spec
      if (open) app.sheets.close()
      if (open?.kind !== 'palette') app.sheets.open('palette', {}, { focus: false })
      return
    }
    if (app.stores.sheet.getState().spec) return // a sheet or menu is open: it has its own keys
    const r = here()
    if (!r) return
    if (!app.desk()) {
      // the phone's keyboard: / opens the search
      if (e.key === '/' && !typingIn(active)) {
        e.preventDefault()
        if (!app.stores.route.getState().layers.includes('search')) app.nav.search(true)
        else app.fields.focus('search')
      }
      return
    }
    if (typingIn(active) || e.altKey) return
    // Enter and Space press the button or link you are on; they are keys only on the page or a row
    if ((e.key === 'Enter' || e.key === ' ') && active && active !== document.body && !active.closest('#list') && active.closest('button, a[href], [role=button], summary')) return
    const m = app.model(r.slug)
    const n = r.place.kind === 'item' && m ? liveN(m, Number(/\d+/.exec(r.place.ref)?.[0])) : null
    const it = n != null ? m?.byN.get(n) : undefined
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && it && m) {
      if (app.answers.send(m, r.slug, it)) e.preventDefault()
      return
    }
    if (e.metaKey || e.ctrlKey) return
    const lists = r.tab !== 'inputs' && r.place.kind !== 'settings'
    if (gAt && Date.now() - gAt < 1000) {
      gAt = 0
      const tab = ({ i: 'items', n: 'inputs', a: 'archive', r: 'rules' } as Record<string, Tab>)[e.key.toLowerCase()]
      if (tab) return (e.preventDefault(), app.nav.tab(tab))
      if (e.key.toLowerCase() === 's') return (e.preventDefault(), app.nav.to(`/p/${encodeURIComponent(r.slug)}/settings`))
      if (e.key.toLowerCase() === 'p') return (e.preventDefault(), app.sheets.open('switch', {}, { focus: false }))
    }
    if (it && armed(e, it)) return
    switch (e.key) {
      case 'j':
      case 'ArrowDown':
      case 'k':
      case 'ArrowUp': {
        const dir = e.key === 'j' || e.key === 'ArrowDown' ? 1 : -1
        if (lists && m) return (e.preventDefault(), app.nav.step(dir, app.listOrder, (k) => codeOf(m, k), say))
        if (e.key === 'j' || e.key === 'k') say(r.place.kind === 'settings' ? 'Press Esc to return to the list' : 'J and K move in Items, Archive and Rules')
        return
      }
      case 'o':
      case 'Enter':
        if (it) return (e.preventDefault(), app.nav.full(!app.stores.route.getState().full))
        if (e.key === 'o') say('First pick an item: J or a click')
        return
      case ' ': {
        const talk = app.fields.get('talk')
        if (it && talk) {
          e.preventDefault()
          talk.scrollBy({ top: (e.shiftKey ? -0.8 : 0.8) * talk.clientHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        }
        return
      }
      case 'g':
        gAt = Date.now()
        return
      case '[':
        e.preventDefault()
        return app.stores.ui.getState().setSideHidden(!app.stores.ui.getState().sideHidden)
      case '/':
        e.preventDefault()
        return requestAnimationFrame(() => app.fields.focus('search'))
      case '?':
        e.preventDefault()
        return app.sheets.open('keys')
      case 'f':
        e.preventDefault()
        return app.stores.ui.getState().setDeskFilters(!app.stores.ui.getState().deskFilters)
      case 'c':
        e.preventDefault()
        return app.nav.newInput()
      case 'z': {
        e.preventDefault()
        const step = app.stores.feedback.getState().undo.at(-1)
        if (step) void step.run()
        else say('Nothing of yours to undo here. Older changes are in Change log')
        return
      }
    }
    if (!it || !m) {
      if (e.key.length === 1 && ITEM_KEYS.includes(e.key)) say(r.tab === 'inputs' || r.place.kind === 'new' ? 'Open an item in Items, Archive or Rules to use these keys' : 'First pick an item: J or a click')
      return
    }
    itemKey(e, it, r.slug)
  }
}
