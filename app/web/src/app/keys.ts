// The keys, for the whole page: each key is looked up in the table of actions (actions.ts), which says whether it can
// act here and does it. On the desktop a single key acts while you are not typing; G then a letter, and S, P or T then
// a digit or letter, are two keys. Esc steps back one level, on the phone too; Cmd-K opens Go to or do. The home page
// has one key: Cmd-K or / go to its search.

import { actionOfKeys, hereOf, pickChoice, runAction, setArmed, type ActionId } from './actions'
import type { App } from './createApp'

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
    const h = hereOf(app)
    if (!h) return
    const act = (id: ActionId | null, quiet = false) => {
      if (id && runAction(app, id, { ...h, shift: e.shiftKey }, quiet)) e.preventDefault()
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
    if (menu && menuKey(app, e, menu.n, menu.arm)) return
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
    if (setArmed(app, h, e.key)) return e.preventDefault()
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') return act(e.key === 'ArrowDown' ? 'step' : 'step-back', true)
    if (e.key === 'Enter') return act('full', true)
    const id = actionOfKeys(e.key)
    if (id) return act(id)
    if (/^[1-9]$/.test(e.key) && pickChoice(app, h, Number(e.key) - 1)) e.preventDefault()
  }
}

const FIELD = { s: 'status', p: 'pri', t: 'type' } as const
const TYPE_OF: Record<string, string> = { f: 'feature', b: 'bug', i: 'idea', t: 'task', r: 'rule' }

/** A key in the desktop's item menu. -> whether it was the menu's */
function menuKey(app: App, e: KeyboardEvent, n: number, arm: 's' | 'p' | 't' | null): boolean {
  const box = app.fields.get('sheet')
  if (!box) return false
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
  const low = k.toLowerCase()
  const f = arm ? FIELD[arm] : null
  const v = arm === 'p' && /^[0-3]$/.test(k) ? 'P' + k : arm === 't' ? TYPE_OF[low] : arm === 's' && /^[1-9]$/.test(k) ? box.querySelectorAll<HTMLElement>('[data-f="status"]')[Number(k) - 1]?.dataset.v : null
  const b = f && v ? box.querySelector<HTMLElement>(`[data-f="${f}"][data-v="${v}"]`) : null
  if (b) {
    e.preventDefault()
    b.focus({ preventScroll: true })
    b.click()
    return true
  }
  if (low === 's' || low === 'p' || low === 't') {
    e.preventDefault()
    const at = app.stores.sheet.getState().spec?.at
    app.sheets.open({ kind: 'item-menu', n, arm: low }, { pop: true, focus: false, narrow: true, at })
    return true
  }
  if (/^[0-9]$/.test(k)) {
    e.preventDefault()
    const count = box.querySelectorAll('[data-f="status"]').length
    app.toasts.show(f ? `${({ pri: 'Priority', type: 'Type', status: 'Status' } as const)[f]}: ${({ pri: '0–3', type: 'F B I T R', status: `1–${count}` } as const)[f]}` : 'First S, P or T: then a digit')
    return true
  }
  return false
}
