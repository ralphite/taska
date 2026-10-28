// The keys, for the whole page: each key is looked up in the table of actions (actions.ts), which says whether it can
// act here and does it. On the desktop a single key acts while you are not typing; G then a letter, and S, P or T then
// a digit or letter, are two keys. Esc steps back one level, on the phone too; Cmd-K opens Go to or do. The home page
// has one key: Cmd-K or / go to its search.

import { actionOfKeys, type ActionId } from './actions'
import { armedSet } from '../model/actions'
import { statusChoices } from '../model/items'
import type { App } from './createApp'
import type { Item } from '../model/types'

const typingIn = (el: Element | null) => /INPUT|TEXTAREA|SELECT/.test(el?.tagName || '') || !!(el as HTMLElement | null)?.isContentEditable

export function pageKeys(app: App): (e: KeyboardEvent) => void {
  let gAt = 0
  return (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const active = document.activeElement
    if (app.stores.route.getState().route.page === 'home') {
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typingIn(active))) {
        e.preventDefault()
        app.fields.focus('home')
      }
      return
    }
    const h = app.actions.here()
    if (!h) return
    const act = (id: ActionId | null, quiet = false) => {
      if (id && app.actions.run(id, { ...h, shift: e.shiftKey }, quiet)) e.preventDefault()
    }
    if (e.key === 'Escape') return act('back')
    // the picture viewer: the arrows go through its pictures; no other key acts under it
    if (app.media.open()) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        app.media.step(e.key === 'ArrowLeft' ? -1 : 1)
      }
      return
    }
    // Cmd-K anywhere on the desktop, even while typing (again: closes it)
    if (app.desk() && (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      const open = app.stores.sheet.getState().spec
      if (open) app.sheets.close()
      if (open?.req.kind !== 'palette') act('palette')
      return
    }
    // the desktop's item menu: arrows walk it, S P T and then a digit or letter set a field, and the keys it shows
    // work from it (it closes, the key acts)
    const menu = app.desk() ? app.sheets.shown('item-menu') : null
    if (menu && menuKey(app, e, h.m?.byN.get(menu.n), menu.arm)) return
    if (menu && /^[a-zA-Z]$/.test(e.key)) app.sheets.close()
    else if (app.stores.sheet.getState().spec) return // a sheet or menu is open: it has its own keys
    if (!app.desk()) {
      if (e.key === '/' && !typingIn(active)) act('search') // the phone's keyboard
      return
    }
    // Option-V in the document editor speaks into the document
    if (e.altKey && e.code === 'KeyV' && !e.metaKey && !e.ctrlKey && app.stores.docView.getState().editing && app.fields.get('doc')) {
      e.preventDefault()
      return app.dictation.toggle()
    }
    // Option-V records even while you type in the box
    if (e.altKey && e.code === 'KeyV' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      if (app.voice.recording()) return void app.voice.finish(false)
      const { key, scope } = app.stores.box.getState().shown
      return void app.voice.start(h.r.slug, key, scope, 'main')
    }
    // while recording, Shift- or Cmd-Enter stops and sends, Enter stops into the box
    if (app.voice.recording() && e.key === 'Enter' && !e.isComposing) {
      e.preventDefault()
      return void app.voice.finish(e.shiftKey || e.metaKey || e.ctrlKey)
    }
    if (typingIn(active) || e.altKey) return
    // the sidebar over the page takes the keys: only [ (or Esc) closes it
    if (app.stores.ui.getState().sideOver && e.key !== '[' && /^[a-zA-Z0-9./[?]$/.test(e.key) && !e.metaKey && !e.ctrlKey) return app.toasts.show('Press [ to close the sidebar')
    // Enter and Space press the button or link you are on; they are keys only on the page or a row
    if ((e.key === 'Enter' || e.key === ' ') && active && active !== document.body && !app.fields.get('list')?.contains(active) && active.closest('button, a[href], [role=button], summary')) return
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') return act('send-answer', true)
    if (e.metaKey || e.ctrlKey) return
    if (gAt && Date.now() - gAt < 1000) {
      gAt = 0
      const id = actionOfKeys('g ' + e.key.toLowerCase())
      if (id) return act(id)
    }
    if (e.key === 'g') {
      gAt = Date.now()
      return
    }
    if (app.actions.setArmed(h, e.key)) return e.preventDefault()
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') return act(e.key === 'ArrowDown' ? 'step' : 'step-back', true)
    if (e.key === 'Enter') return act('full', true)
    const id = actionOfKeys(e.key)
    if (id) return act(id)
    if (/^[1-9]$/.test(e.key) && app.actions.pickChoice(h, Number(e.key) - 1)) e.preventDefault()
  }
}

/** A key in the desktop's item menu: the arrows walk it; with S, P or T shown, the key sets that field (as the
 * menu numbers it); S, P or T show that field. -> whether it was the menu's */
function menuKey(app: App, e: KeyboardEvent, it: Item | undefined, arm: 's' | 'p' | 't' | null): boolean {
  const box = app.fields.get('sheet')
  if (!box || !it) return false
  const k = e.key
  if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) {
    const btns = [...box.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    const d = k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey) ? 1 : -1
    e.preventDefault()
    btns[i < 0 ? (d > 0 ? 0 : btns.length - 1) : (i + d + btns.length) % btns.length]?.focus()
    return true
  }
  if (k.length !== 1 || (e.shiftKey && k !== k.toLowerCase())) return false // C, D, A with Shift: the menu's own keys
  const statuses = statusChoices(it).map(([v]) => v)
  const to = arm ? armedSet(arm, k, statuses) : null
  if (to) {
    e.preventDefault()
    app.sheets.close()
    void app.items.change(it.n, to[0], to[1])
    return true
  }
  const low = k.toLowerCase()
  if (low === 's' || low === 'p' || low === 't') {
    e.preventDefault()
    const at = app.stores.sheet.getState().spec?.at
    app.sheets.open({ kind: 'item-menu', n: it.n, arm: low }, { pop: true, focus: false, narrow: true, at })
    return true
  }
  if (/^[0-9]$/.test(k)) {
    e.preventDefault()
    app.toasts.show(arm === 'p' ? 'Priority: 0–3' : arm === 't' ? 'Type: F B I T R' : arm === 's' ? `Status: 1–${statuses.length}` : 'First S, P or T: then a digit')
    return true
  }
  return false
}
