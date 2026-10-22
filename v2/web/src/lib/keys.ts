// One table drives the keys (desktop). Single keys act only while you are not typing; Esc steps back one level.
import { RULE_STATUS, STATUS, TYPE_OF_LETTER } from './constants'
import {
  talkScroller,
  CLOSED,
  D,
  DR,
  OV,
  R_STATE as R,
  U,
  bump,
  byN,
  code,
  desk,
  detailShown,
  docById,
  els,
  render,
  walkTab,
  canDone,
} from './state'
import { hasChoices } from './markdown'
import { hint, toast } from './toast'
import { change, undoMine } from './data'
import { kept } from './drafts'
import { closeDialog, openDialog } from './dialog'
import {
  clearSearch,
  closeDrawer,
  closeItem,
  fullWidth,
  leaveCompose,
  openProject,
  searchMode,
  setTab,
  stepItem,
  toList,
} from './nav'
import { startGoDesk } from './go'
import { closeDoc, renderDoc } from './docs'
import { cancelRec, docRecStart, docRecStop, finishRec, startRec, DV } from './voice'
import { cancelPrefs } from './settings'
import { stashEdit } from './edit'
import { ACT, itemMenuDesk, movePicker, showFilters, type Data } from './actions'
import { VW } from './viewer'

export const ITEM_KEYS = new Set([...'arndwle.sptmiCDA']) // the keys that act on the selected item
export const KEYS: [string, [string, string][]][] = [
  [
    'Move',
    [
      ['J / K', 'Next or previous item'],
      ['⇧J / ⇧K', 'Next or previous item that needs you (Go through)'],
      ['O or ↵', 'Full width; Esc goes back'],
      ['Space', 'Scroll the item'],
      ['G then I N A R', 'Items, New input (what you said), Archive, Rules'], // T438 #14 (B16): as they are
      ['G then P', 'Switch project (type to find it)'],
      ['G then S', 'Settings'],
      ['[', 'Show or hide the sidebar'],
    ],
  ],
  [
    'Act on the selected item',
    [
      ['A', "The item's next step: Accept, Approve, Answer or Reply"],
      ['R', 'Reply or add to it'],
      ['N', 'Not yet: back to in progress at once'],
      ['1–9, ⌘↵', 'Pick a choice, send the answer'],
      ['D · W · L', "Done · Won't do · Later / Now"],
      ['E / ⇧E', 'Archive or unarchive / archive every finished item'],
      ['S · P · T', 'Status, priority, type: then the digit its menu shows'],
      ['M · ⇧C', 'Put under… · Copy for agent'],
      ['I · ⇧D · ⇧A', 'Edit · New doc · Add subitem'],
      ['.', 'All actions'],
      ['Z', 'Undo your last action here, again for the one before; older changes: Change log'],
    ],
  ],
  [
    'Mouse',
    [
      ['Hover a row', 'Its quick actions, always in the same places'],
      ['Right-click a row', 'Its menu, at the pointer'],
      ['Click cut-off words', 'Show them all'],
      ['Drag a pane edge', 'Resize; double-click for the default'],
    ],
  ],
  [
    'Write and find',
    [
      ['⌘K', 'Go to an item or do anything here'],
      ['⌘ / ⇧ click', 'Pick several rows, then act on them at once'],
      ['C', 'New input to the project'],
      ['V', 'Voice note for the selected item; V again stops'],
      ['⇧V', 'New input by voice; ⇧V again stops and sends'],
      ['⌥V', 'Voice note while typing in the box'],
      ['↵', 'While recording: stop, into the box'],
      ['⇧↵ or ⌘↵', 'Send; while recording: stop and send'],
      ['/', 'Search'],
      ['F', 'Filters'],
      ['?', 'This sheet'],
      ['Esc', 'Step back one level'],
    ],
  ],
]
export const showKeys = () => openDialog('keys')
export const projectSwitcher = () => openDialog('switch', {}, { focus: false })
export const palette = () => openDialog('palette', {}, { focus: false })
const overlayHidden = () => !OV.spec
const typingIn = (el: Element | null) =>
  /INPUT|TEXTAREA|SELECT/.test(el?.tagName || '') || !!(el as HTMLElement | null)?.isContentEditable
const fieldFocused = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')

export function cancelCorrect() {
  U.correct = null
  getSelection()?.removeAllRanges()
  render()
}
export function cancelAmend() {
  U.amend = null
  render()
}

// S P T then a digit or letter; arrows and Tab stay in it (T113 A16, B8)
function menuKey(e: KeyboardEvent) {
  const k = e.key,
    box = els.dlgBody
  if (!box) return false
  if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) {
    const btns = [...box.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],
      i = btns.indexOf(document.activeElement as HTMLButtonElement)
    const d = k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey) ? 1 : -1
    e.preventDefault()
    btns[i < 0 ? (d > 0 ? 0 : btns.length - 1) : (i + d + btns.length) % btns.length]?.focus()
    return true
  }
  if (k.length !== 1 || (e.shiftKey && k !== k.toLowerCase())) return false // C, D, A with Shift: the menu's own shortcuts (B131)
  const low = k.toLowerCase(),
    f = ({ p: 'pri', t: 'type', s: 'status' } as Record<string, string>)[U.menuArm || '']
  const v =
    U.menuArm === 'p' && /^[0-3]$/.test(k)
      ? 'P' + k
      : U.menuArm === 't'
        ? TYPE_OF_LETTER[low]
        : U.menuArm === 's' && /^[1-9]$/.test(k)
          ? box.querySelectorAll<HTMLElement>('[data-f="status"]')[Number(k) - 1]?.dataset.v
          : null
  const b = f && v && box.querySelector<HTMLElement>(`[data-f="${f}"][data-v="${v}"]`)
  if (b) {
    e.preventDefault()
    b.focus({ preventScroll: true })
    b.click()
    return true
  } // the key stays on what it set
  if (['s', 'p', 't'].includes(low)) {
    e.preventDefault()
    itemMenuDesk(U.menuFor, low)
    return true
  }
  if (/^[0-9]$/.test(k)) {
    e.preventDefault()
    const n = box.querySelectorAll('[data-f="status"]').length
    hint(
      f
        ? `${({ pri: 'Priority', type: 'Type', status: 'Status' } as Record<string, string>)[f]}: ${({ pri: '0–3', type: 'F B I T R', status: `1–${n}` } as Record<string, string>)[f]}`
        : 'First S, P or T: then a digit',
    )
    return true
  }
  return false
}

export function deskKey(e: KeyboardEvent) {
  if (!desk() || e.defaultPrevented) return
  const el = document.activeElement as HTMLElement | null,
    typing = typingIn(el)
  // Option-V records even while you type in the box (B91); in the document editor it speaks into the document (F208).
  if (e.altKey && e.code === 'KeyV' && !e.metaKey && !e.ctrlKey && U.docEdit && document.getElementById('docMd')) {
    e.preventDefault()
    return DV.rec ? docRecStop() : docRecStart()
  }
  if (e.altKey && e.code === 'KeyV' && !e.metaKey && !e.ctrlKey && !VW.open && overlayHidden()) {
    e.preventDefault()
    return R.rec ? finishRec(false) : startRec()
  }
  if (typing || e.altKey || VW.open) return
  // While recording, the keys of the box (F095): Enter stops into the box, Shift/Cmd-Enter stops and sends.
  if (R.rec && e.key === 'Enter' && !e.isComposing && (e.shiftKey || e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    return finishRec(true)
  }
  if (R.rec && e.key === 'Enter' && !e.isComposing && el?.closest?.('#composer, #vcBar')) {
    e.preventDefault()
    return finishRec(false)
  } // T242 #1
  // Enter and Space press the button, link or choice you are on (B123); they are shortcuts only on the page or a row.
  if (
    (e.key === 'Enter' || e.key === ' ') &&
    el &&
    el !== document.body &&
    !el.closest('#list') &&
    el.closest('button, a[href], [role=button], summary')
  )
    return
  if (R.rec && e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    return finishRec(false)
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && U.choice && U.choice.n === U.open) {
    e.preventDefault()
    return document.querySelector<HTMLElement>(`[data-act="choice-send"][data-n="${U.open}"]`)?.click()
  }
  if (e.metaKey || e.ctrlKey) return
  const menuOpen =
    (U.sheet === 'menu' || (desk() && U.sheet === 'pick' && OV.spec?.kind === 'menu-desk')) && !overlayHidden() // B358: a field's list too
  if (menuOpen && menuKey(e)) return
  if (menuOpen && /^[a-zA-Z]$/.test(e.key)) closeDialog() // the keys the menu shows work from it (B131)
  if (!overlayHidden()) return // a sheet or menu is open: it has its own keys (Esc closes it)
  const k = e.key,
    one = /^[a-zA-Z0-9./[?]$/.test(k)
  if (D.sideOpen && k !== '[') {
    if (one) hint('The sidebar is over the page: [ closes it')
    return
  } // B120
  const n = detailShown() && !D.compose ? U.open : null,
    it = n != null ? byN.get(n) : undefined,
    lists = U.tab !== 'inputs' && !D.page
  const doc = desk() && U.doc && !U.docEdit && docById(U.doc),
    back = n ? `Back to ${code(n)} first: Esc` : ''
  if (D.g && Date.now() - D.g < 1000) {
    // G then a letter
    D.g = 0
    const tab = ({ i: 'items', n: 'inputs', a: 'archive', r: 'rules' } as const)[k.toLowerCase() as 'i']
    if (tab) {
      e.preventDefault()
      return setTab(tab)
    }
    if (k.toLowerCase() === 'p') {
      e.preventDefault()
      return projectSwitcher()
    }
    if (k.toLowerCase() === 's') {
      e.preventDefault()
      return openProject(D.page ? D.section : 'agents')
    } // Settings (B162)
  }
  const act = (name: string, data: Data = {}) => {
    e.preventDefault()
    return ACT[name]({ n: String(n), ...data }, e)
  }
  const status = (v: string) => it && act('status', { v })
  const arm = U.armKey
  U.armKey = null
  if (arm && it && arm.n === n && Date.now() - arm.t < 3000) {
    // B264: S, P or T, then the key that says what to set
    const sts = it.type === 'rule' ? Object.keys(RULE_STATUS) : Object.keys(STATUS)
    const [f, v] =
      arm.k === 'p'
        ? ['pri', /^[0-3]$/.test(k) && 'P' + k]
        : arm.k === 't'
          ? ['type', TYPE_OF_LETTER[k.toLowerCase()]]
          : ['status', /^[1-9]$/.test(k) && sts[Number(k) - 1]]
    if (v) {
      e.preventDefault()
      return f === 'status' ? status(v) : change(n as number, f as string, v)
    }
  }
  switch (k) {
    case 'j':
    case 'ArrowDown':
    case 'k':
    case 'ArrowUp': {
      const dir = k === 'j' || k === 'ArrowDown' ? 1 : -1,
        letter = k === 'j' || k === 'k'
      if (doc) {
        if (letter) hint(back)
        return
      }
      if (lists) {
        e.preventDefault()
        return stepItem(dir)
      }
      if (letter)
        hint(D.page ? 'J and K move in a list: Esc goes back to it' : 'J and K move in Items, Archive and Rules')
      return
    }
    case 'J':
    case 'K':
      e.preventDefault()
      if (U.go) return ACT[k === 'J' ? 'go-next' : 'go-prev']({})
      if (walkTab() !== U.tab || D.page) setTab('items')
      return startGoDesk(U.open)
    case 'o':
    case 'Enter':
      if (it) {
        e.preventDefault()
        fullWidth(!D.full)
      } else if (k === 'o') hint('First pick an item: J or a click')
      return
    case ' ':
      if (it && talkScroller()) {
        const talk = talkScroller()!
        e.preventDefault()
        talk.scrollBy({
          top: (e.shiftKey ? -0.8 : 0.8) * talk.clientHeight,
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        })
      }
      return
    case 'g':
      D.g = Date.now()
      return
    case '[':
      e.preventDefault()
      return ACT.side({})
    case '/':
      e.preventDefault()
      toList()
      requestAnimationFrame(() => els.q?.focus())
      return
    case 'f':
      e.preventDefault()
      toList()
      return showFilters()
    case '?':
      e.preventDefault()
      return showKeys()
    case 'c':
      e.preventDefault()
      return ACT['new-input']({})
    case 'z':
      e.preventDefault()
      return undoMine()
    case 'E':
      e.preventDefault()
      return ACT['archive-all']({})
    case 'v':
      e.preventDefault()
      return R.rec ? finishRec(false) : startRec()
    case 'V':
      e.preventDefault()
      if (R.rec) return finishRec(true)
      ACT['new-input']({})
      return startRec()
  }
  if (!it || n == null) {
    if (ITEM_KEYS.has(k))
      hint(
        U.tab === 'inputs' || D.page || D.compose
          ? 'Item keys work on an item: open one in Items, Archive or Rules'
          : 'First pick an item: J or a click',
      )
    return
  }
  if (doc) {
    if (k === 'i') {
      e.preventDefault()
      return ACT['doc-edit']({})
    }
    if (k === 'r') {
      e.preventDefault()
      return ACT.reply({})
    }
    if (ITEM_KEYS.has(k)) hint(back)
    return
  }
  const ruleTo = (v: string) =>
    it.status === v ? hint(`${code(n)} is ${v === 'open' ? 'active' : 'retired'} already`) : status(v) // T113 B21
  switch (k) {
    case 'a':
      if (it.status === 'review') return status('done')
      if (it.status === 'proposed') return status('open')
      if (it.wait?.kind === 'ask' && hasChoices(it.wait.text)) {
        e.preventDefault()
        return document.querySelector<HTMLElement>(`#detailBody [data-act="choice"][data-n="${n}"]`)?.focus()
      }
      if (it.wait) {
        e.preventDefault()
        return ACT.reply({})
      }
      return toast(`Nothing waits on you in ${code(n)}`)
    case 'r':
      e.preventDefault()
      return ACT.reply({})
    case 'n':
      if (it.status === 'review') return act('reopen')
      return toast('Not yet works on items in review')
    case 'd':
      return it.type === 'rule'
        ? ruleTo('open')
        : CLOSED(it.status)
          ? hint(`${code(n)} is ${it.status === 'done' ? 'done' : "marked won't do"} already`)
          : !canDone(it) // T438 #14 (B11): D does what the bar's Done does
            ? hint(
                it.status === 'proposed'
                  ? `${code(n)} is proposed: approve it first (A)`
                  : `${code(n)} waits for you to accept it (A)`,
              )
            : status('done')
    case 'w':
      return it.type === 'rule'
        ? ruleTo('dropped')
        : it.status === 'dropped'
          ? hint(`${code(n)} is marked won't do already`)
          : status('dropped')
    case 'l':
      if (it.type !== 'rule' && !CLOSED(it.status)) act('swipe', { f: 'when', v: it.when === 'now' ? 'later' : 'now' })
      else hint(it.type === 'rule' ? 'Rules have no Later' : 'Later works on open items')
      return
    case 'e':
      act('archive', { on: it.archived ? '0' : '1' })
      return // F281: any state
    case '.':
      e.preventDefault()
      return itemMenuDesk(n, null)
    case 's':
    case 'p':
    case 't':
      e.preventDefault()
      U.armKey = { k, n, t: Date.now() }
      return hint(({ s: 'Status: 1–6', p: 'Priority: 0–3', t: 'Type: F B I T R' } as Record<string, string>)[k])
    case 'm':
      e.preventDefault()
      return movePicker(n)
    case 'C':
      return act('copy')
    case 'i':
      return act('edit')
    case 'D':
      return act('doc-new')
    case 'A':
      return act('sub-new')
  }
  if (/^[1-9]$/.test(k) && it.wait?.kind === 'ask') {
    const b = document.querySelector<HTMLElement>(
      `#detailBody [data-act="choice"][data-n="${n}"][data-i="${Number(k) - 1}"]`,
    )
    if (b) {
      e.preventDefault()
      b.click()
    }
  }
}

// Esc steps back one level: the drawer, the viewer, the recording, a correction or an edit, a picked passage, the
// sheet, a field, the sidebar, Settings, the filters, Go through, full width, New input, the search, the item.
export function escapeKey(e: KeyboardEvent) {
  const t = els.text,
    inBox = () => document.activeElement === t && !!t?.value.trim() && desk()
  if (e.key === 'Escape') {
    if (DR.open) return closeDrawer()
    if (VW.open) return ACT['v-close']({})
    if (R.rec) return void cancelRec()
    if (U.correct && !inBox()) return cancelCorrect() // F144
    if (U.amend && !inBox()) return cancelAmend() // B136
    if (U.prefsEdit && !inBox()) return cancelPrefs() // F183
    if (U.doc && U.docCircle) {
      U.docCircle = false
      return renderDoc()
    }
    if (U.doc && (U.docQuote || U.docSel.size || U.docReply)) return ACT['doc-unpick']({})
    if (desk() && U.doc && U.docEdit && overlayHidden()) {
      e.preventDefault()
      return closeDoc()
    } // T274 #11
    if (desk() && U.doc && !U.docEdit && overlayHidden() && D.full && !fieldFocused()) return fullWidth(false)
    if (desk() && U.doc && !U.docEdit && overlayHidden() && !fieldFocused()) return closeDoc()
    if (!overlayHidden()) return closeDialog()
    if (document.activeElement?.id === 'subTitle') {
      // done adding subitems; a title you started is kept (T113 A15)
      const n = U.subFor,
        v = (document.getElementById('subTitle') as HTMLInputElement).value.trim()
      kept('subs', (all) => {
        if (n == null) return
        if (v) all[n] = v
        else delete all[n]
      })
      if (v) toast(`Your subitem title is kept: ${desk() ? '⇧A' : 'Add'} brings it back`)
      U.subFor = null
      return bump('detail')
    }
    if (U.editing) {
      stashEdit()
      U.editing = null
      return bump('detail', 'composer')
    }
    if (desk()) {
      if (D.compose && document.activeElement === t && !t?.value.trim() && !U.files.length) return leaveCompose()
      if (document.activeElement === els.q) {
        if (U.q) clearSearch()
        return els.q?.blur()
      } // B122
      if (fieldFocused()) return (document.activeElement as HTMLElement).blur()
      if (D.sideOpen) {
        D.sideOpen = false
        return render()
      }
      if (D.page) return ACT['project-back']({})
      if (D.filters) {
        D.filters = false
        return render()
      }
      if (U.go) return ACT['go-end']({})
      if (D.full) return fullWidth(false)
      if (D.compose) return leaveCompose()
      if (U.q) return clearSearch()
      if (U.open && U.tab !== 'inputs') return closeItem()
      return
    }
    if (U.open && !fieldFocused()) return ACT.back({})
  }
  if (VW.open && e.key === 'ArrowLeft') ACT['v-prev']({})
  if (VW.open && e.key === 'ArrowRight') ACT['v-next']({})
  if (e.key === '/' && !desk() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
    e.preventDefault()
    if (!U.searching) ACT.search({})
    else els.q?.focus()
  }
  if (e.key === 'Escape' && (U.searching || U.q) && document.activeElement === els.q && !desk()) searchMode(false)
}

// Esc lets go of the picked rows first; Cmd-K anywhere on the desktop, even while typing.
export function captureKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && U.sel.size && overlayHidden() && !fieldFocused()) {
    e.preventDefault()
    e.stopImmediatePropagation()
    U.sel.clear()
    bump('list')
    return
  }
  if (desk() && (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (OV.spec) {
      const again = OV.spec.kind === 'palette'
      closeDialog()
      if (again) return
    }
    palette()
  }
}

// The command palette's rows (T274 #33): a command replays its keys, so it does exactly what the key does where you are.
export const CP_PAGE: [string, string][] = [
  ['New input', 'c'],
  ['Search', '/'],
  ['Filter', 'f'],
  ['Go through what needs you', 'J'],
  ['Record a voice input', 'V'],
  ['Items', 'g i'],
  ['Inputs', 'g n'],
  ['Archive', 'g a'],
  ['Rules', 'g r'],
  ['Switch project', 'g p'],
  ['Settings', 'g s'],
  ['Show or hide the sidebar', '['],
  ['Undo', 'z'],
  ['Keyboard shortcuts', '?'],
]
export const CP_ITEM: [string, string][] = [
  ['Accept or approve', 'a'],
  ['Reply', 'r'],
  ['Not yet', 'n'],
  ['Done', 'd'],
  ['Later or back to now', 'l'],
  ['Archive', 'e'],
  ["Won't do", 'w'],
  ['Edit', 'i'],
  ['Status…', 's'],
  ['Priority…', 'p'],
  ['Type…', 't'],
  ['Put under…', 'm'],
  ['Add subitem', 'A'],
  ['New doc', 'D'],
  ['Copy for agent', 'C'],
  ['Full width', 'o'],
]
export function paletteRun(keys: string) {
  closeDialog()
  ;(document.activeElement as HTMLElement | null)?.blur()
  const t0 = Date.now()
  const go = () => {
    if (OV.spec && Date.now() - t0 < 1000) return requestAnimationFrame(go)
    for (const key of keys.split(' '))
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  }
  go()
}
