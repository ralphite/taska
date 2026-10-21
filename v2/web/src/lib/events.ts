// The page's listeners, set once: one click handler for every data-act (B159: a button waiting on the server is busy),
// the press feedback (T160), the tooltip (T094), the keys, the pane edges (F89), the phone's drawer and back swipe,
// the selection (F144, F184, T274 #1), leaving and coming back, Back and Forward.
import { D, DR, OV, U, bump, byR, desk, docById, els, model, onLayout, reduceMotion, render, sleep } from './state'
import { ACT, itemMenuDesk, projectMenu, type Data } from './actions'
import { captureKey, deskKey, escapeKey } from './keys'
import { closeDialog, popAt } from './dialog'
import { closeDrawer, fullWidth, openItem, searchMode, applyURL } from './nav'
import { openDrawer } from './actions'
import { closeSwipe, SW } from './rows'
import { checkOthers, refresh } from './data'
import { resendOutbox, warnUnload } from './outbox'
import { kept, onStorage, keepChoice } from './drafts'
import { keepItemEdit } from './edit'
import { docKey, noteText } from './docs'
import { micRelease, doubtPick } from './voice'
import { cancelCorrect } from './keys'
import { refCard } from './markdown'
import { layersNow, layAt, ownPop, setLayAt, setPopping, writeURL, URLS } from './url'
import { closeViewer, VW } from './viewer'
import { hint } from './toast'
import { draftFix, footRoom } from '../components/Composer'
import { LAST, drawerW, setDrawer } from '../components/Shell'
import { SWIPE, ctx, esc } from './state'
import { PAGE, goTo } from './switch'
import { PDRAG } from './projdrag'

// ---------------------------------------------------------------- press feedback (T160)
const PRESS = { el: null as HTMLElement | null, id: null as number | null, x: 0, y: 0, t: 0, off: 0, mouse: false }
const PRESSABLE = 'button, a[href], summary, [data-act], [role=button]'
function press(el: HTMLElement) {
  clearTimeout(PRESS.off)
  if (PRESS.el && PRESS.el !== el) PRESS.el.removeAttribute('data-pressed')
  PRESS.el = el
  PRESS.t = performance.now()
  el.setAttribute('data-pressed', '')
}
function unpress(tap = false) {
  // tap: it ends in a tap, so it stays the 130 ms; otherwise it goes now
  const el = PRESS.el
  PRESS.id = null
  if (!el) return
  clearTimeout(PRESS.off)
  const end = () => {
    el.removeAttribute('data-pressed')
    if (PRESS.el === el) PRESS.el = null
  }
  const left = tap ? 130 - (performance.now() - PRESS.t) : 0
  if (left > 0) PRESS.off = window.setTimeout(end, left)
  else end()
}

// ---------------------------------------------------------------- the tooltip (T094)
const TIP = {
  el: null as HTMLElement | null,
  t: 0,
  closedAt: 0,
  hush: null as Element | null,
  fine: matchMedia('(hover: hover) and (pointer: fine)'),
}
function tipText(el: HTMLElement) {
  if (el.title) {
    el.dataset.tip = el.title
    el.removeAttribute('title')
  }
  return el.dataset.tip || (!el.textContent?.trim() && el.getAttribute('aria-label')) || ''
}
function tipShow(el: HTMLElement, quick: boolean) {
  const card = el.dataset.ref ? refCard(el.dataset.ref) : '',
    text = card || tipText(el) // F297: a code's card
  const tip = document.getElementById('tip'),
    tt = document.getElementById('tipText'),
    a = document.getElementById('tipArrow')
  if (!text || !el.isConnected || !tip || !tt || !a) return
  const parts = text.split(' · '),
    key = parts.length > 1 && /^(\S{1,4}|G [A-Z]|Esc)$/.test(parts.at(-1) || '') ? parts.pop() : ''
  tip.toggleAttribute('data-card', !!card)
  tt.innerHTML =
    card ||
    esc(parts.join(' · ')) +
      (key
        ? `<kbd class="ml-1.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded px-1 font-sans text-[11px] font-semibold ring-1 ring-current/30">${esc(key)}</kbd>`
        : '')
  TIP.el = el
  tip.hidden = false
  tip.removeAttribute('data-on')
  tip.style.transition = quick ? 'none' : ''
  const r = el.getBoundingClientRect(),
    w = tip.offsetWidth,
    h = tip.offsetHeight,
    gap = 8,
    pad = 8
  let side =
    el.dataset.tipSide || (el.closest('#drawer, #rail') ? 'right' : el.closest('header, #goStrip') ? 'bottom' : 'top')
  const room: Record<string, number> = {
    top: r.top - h - gap,
    bottom: innerHeight - r.bottom - h - gap,
    right: innerWidth - r.right - w - gap,
    left: r.left - w - gap,
  }
  const flip: Record<string, string> = { top: 'bottom', bottom: 'top', right: 'left', left: 'right' }
  if (room[side] < pad && room[flip[side]] > room[side]) side = flip[side] // no room: the other side
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  let x: number, y: number
  if (side === 'top' || side === 'bottom') {
    x = clamp(r.left + r.width / 2 - w / 2, pad, innerWidth - w - pad)
    y = side === 'top' ? r.top - h - gap : r.bottom + gap
  } else {
    y = clamp(r.top + r.height / 2 - h / 2, pad, innerHeight - h - pad)
    x = side === 'right' ? r.right + gap : r.left - w - gap
  }
  tip.style.translate = `${Math.round(x)}px ${Math.round(y)}px`
  const ax = clamp(r.left + r.width / 2 - x - 4, 8, w - 16),
    ay = clamp(r.top + r.height / 2 - y - 4, 8, h - 16)
  Object.assign(
    a.style,
    side === 'top'
      ? { left: ax + 'px', top: h - 4 + 'px' }
      : side === 'bottom'
        ? { left: ax + 'px', top: '-4px' }
        : side === 'right'
          ? { top: ay + 'px', left: '-4px' }
          : { top: ay + 'px', left: w - 4 + 'px' },
  )
  el.setAttribute('aria-describedby', 'tip')
  requestAnimationFrame(() => tip.setAttribute('data-on', ''))
}
export function tipHide() {
  clearTimeout(TIP.t)
  if (!TIP.el) return
  TIP.el.removeAttribute('aria-describedby')
  TIP.el = null
  TIP.closedAt = Date.now()
  const tip = document.getElementById('tip')
  if (tip) {
    tip.hidden = true
    tip.removeAttribute('data-on')
  }
}
const tipTarget = (t: EventTarget | null) =>
  (t as Element | null)?.closest?.<HTMLElement>('[data-ref], [data-tip], [title], button[aria-label], a[aria-label]') ||
  null

// ---------------------------------------------------------------- Back: what is open but has no step any more closes (B150)
function closeLayers() {
  const keep = layersNow()
  let shut = false
  setPopping(true)
  try {
    if (VW.open && !keep.includes('viewer')) {
      closeViewer()
      shut = true
    }
    if (OV.spec && !U.doc && !keep.includes('sheet')) {
      closeDialog()
      shut = true
    }
    if (DR.open && !keep.includes('drawer')) {
      closeDrawer()
      shut = true
    }
    if (U.searching && !keep.includes('search')) {
      searchMode(false)
      shut = true
    }
  } finally {
    setPopping(false)
  }
  return shut
}

// ---------------------------------------------------------------- pane edges (F89)
const GRIP: Record<string, [string, string, number, number]> = {
  side: ['drawer', '--side-w', 1, 100000], // T322: as wide or narrow as you drag it
  list: ['app', '--list-w', 1, 100000],
  top: ['', '--top-h', 1, 100000], // T322: the item above its talk; dragged up and down, anywhere you like
}
function setGrip(kind: string, px: number) {
  const [id, v] = GRIP[kind],
    el = id ? document.getElementById(id) : document.documentElement
  if (!el) return
  if (px) el.style.setProperty(v, px + 'px')
  else el.style.removeProperty(v)
}
export function restoreGrips() {
  try {
    for (const k in GRIP) {
      const w = Number(localStorage.getItem('taska.w.' + k))
      if (w) setGrip(k, w)
    }
  } catch {
    /* no storage */
  }
}

const dataOf = (b: HTMLElement): Data => ({ ...b.dataset, ...(b.closest('#list') ? { inList: '1' } : {}) })
let wired = false
export function wire() {
  if (wired) return
  wired = true
  // T339: the home page shows in this same page now; while it does, none of the project page's listeners act
  const own = [document, window] as const,
    plain = own.map((t) => t.addEventListener)
  for (const t of own)
    t.addEventListener = function (type: string, fn: EventListenerOrEventListenerObject | null, o?: unknown) {
      const run = typeof fn === 'function' ? fn : fn ? (e: Event) => fn.handleEvent(e) : null
      return EventTarget.prototype.addEventListener.call(
        this,
        type,
        run && ((e: Event) => void (PAGE.home || run.call(this, e))),
        o as AddEventListenerOptions,
      )
    }
  try {
    wireAll()
  } finally {
    own.forEach((t, i) => (t.addEventListener = plain[i]))
  }
}
function wireAll() {
  // the pane you last acted in, for where feedback shows (B129)
  document.addEventListener(
    'pointerdown',
    (e) => {
      LAST.pane =
        (e.target as Element).closest?.<HTMLElement>(
          '#list, #detailView, #drawer, #inputsView, #projectBody, #projectView, #foot',
        ) || LAST.pane
    },
    true,
  )
  document.addEventListener(
    'keydown',
    () => {
      if (desk() && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || ''))
        LAST.pane = document.getElementById('detailView')
    },
    true,
  )
  // press feedback
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.isPrimary || e.button > 0) return
      const el = (e.target as Element).closest?.<HTMLElement>(PRESSABLE)
      unpress()
      if (!el || (el as HTMLButtonElement).disabled || el.matches('[aria-busy=true], [aria-disabled=true]')) return
      press(el)
      Object.assign(PRESS, { id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse' })
    },
    true,
  )
  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerId !== PRESS.id) return
      if (
        Math.hypot(e.clientX - PRESS.x, e.clientY - PRESS.y) > 10 ||
        (PRESS.mouse && !PRESS.el?.contains(e.target as Node))
      )
        unpress()
    },
    true,
  )
  document.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerId === PRESS.id) unpress(true)
    },
    true,
  )
  document.addEventListener('pointercancel', () => unpress(), true)
  document.addEventListener(
    'scroll',
    (e) => {
      if (PRESS.id !== null && (e.target as Node).contains?.(PRESS.el)) unpress()
    },
    true,
  )
  document.addEventListener(
    'contextmenu',
    () => {
      if (PRESS.id !== null) unpress()
    },
    true,
  )
  addEventListener('blur', () => unpress())
  document.addEventListener(
    'click',
    (e) => {
      // Enter or Space on a button shows the press too
      const el = !e.detail && (e.target as Element).closest?.<HTMLElement>(PRESSABLE)
      if (el && !(el as HTMLButtonElement).disabled) {
        press(el)
        unpress(true)
      }
    },
    true,
  )
  // one handler for every action
  document.addEventListener('click', (e) => {
    const t = e.target as Element
    if (t.closest('a[href]:not([data-act])')) return // a link inside a tappable paragraph still opens
    if (t.closest('[data-toast]')) return
    if (Date.now() - SW.swallow < 400) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (SW.open && !t.closest('[data-swipe-right]')) {
      closeSwipe()
      e.preventDefault()
      return
    }
    const b = t.closest<HTMLElement>('[data-act]')
    if (b?.getAttribute('aria-busy') === 'true') {
      e.preventDefault()
      return
    } // still waiting on the server (B159)
    const held = !desk() && b?.closest<HTMLElement>('article[data-settled]')
    if (held && Date.now() - Number(held.dataset.settled) < 600) {
      e.preventDefault()
      return
    } // a double tap's second tap, on the row it just settled (B148)
    if (b?.hasAttribute('data-expand') && !getSelection()?.isCollapsed) return // selecting words to copy them
    if (b && ACT[b.dataset.act || '']) {
      e.preventDefault()
      const r = ACT[b.dataset.act as string](dataOf(b), e) as Promise<unknown> | undefined
      if (r && typeof r.finally === 'function' && b.tagName === 'BUTTON') {
        b.setAttribute('aria-busy', 'true')
        r.finally(() => b.removeAttribute('aria-busy'))
      } // waiting on the server: dim, no second tap
    }
  })
  // a double click on a row: open it full width (the first click redraws the row, so no dblclick event comes)
  document.addEventListener('click', (e) => {
    const r = desk() && e.detail === 2 && (e.target as Element).closest<HTMLElement>('#list [data-act="open"][data-n]')
    if (r && !(e.target as Element).closest('button')) {
      openItem(Number(r.dataset.n))
      fullWidth(true)
    }
  })
  document.addEventListener('contextmenu', (e) => {
    const t = e.target as Element
    const r = desk() && t.closest<HTMLElement>('#list [data-act="open"][data-n]')
    if (r) {
      e.preventDefault()
      openItem(Number(r.dataset.n))
      itemMenuDesk(Number(r.dataset.n))
      popAt(e.clientX, e.clientY)
    }
    const p = desk() && t.closest<HTMLElement>('#drawerList a[data-slug], #rail a[data-slug]') // a project: its menu (F173)
    if (p) {
      e.preventDefault()
      projectMenu(p.dataset.slug, [e.clientX, e.clientY])
    }
  })
  // tooltip
  document.addEventListener('pointerover', (e) => {
    if (!TIP.fine.matches || e.pointerType === 'touch') return
    const t = e.target as Element
    if (t.closest('#tip')) {
      clearTimeout(TIP.t)
      return
    }
    const el = tipTarget(t)
    if (el === TIP.el) {
      clearTimeout(TIP.t)
      return
    }
    if (!el || el === TIP.hush || e.buttons) {
      if (TIP.el) {
        clearTimeout(TIP.t)
        TIP.t = window.setTimeout(tipHide, 100)
      }
      return
    }
    tipText(el) // the browser's own tooltip must not start
    const quick = Date.now() - TIP.closedAt < 300 || !!TIP.el
    clearTimeout(TIP.t)
    if (quick) {
      tipHide()
      tipShow(el, true)
    } else TIP.t = window.setTimeout(() => tipShow(el, false), 500)
  })
  document.addEventListener('pointerout', (e) => {
    const to = e.relatedTarget as Element | null
    if (TIP.hush && !TIP.hush.contains(to)) TIP.hush = null
    if (to && (to.closest?.('#tip') || (TIP.el && TIP.el.contains(to)))) return
    clearTimeout(TIP.t)
    if (TIP.el) TIP.t = window.setTimeout(tipHide, 100)
  })
  document.addEventListener('focusin', (e) => {
    const el = tipTarget(e.target)
    if (TIP.fine.matches && el && (e.target as Element).matches(':focus-visible')) {
      tipHide()
      tipShow(el, true)
    }
  })
  document.addEventListener('focusout', () => tipHide())
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (TIP.el || TIP.t) {
        TIP.hush = tipTarget(e.target)
        tipHide()
      }
    },
    true,
  )
  document.addEventListener('scroll', () => tipHide(), true)
  addEventListener('resize', () => tipHide())
  // T229 #1: on a touch screen, holding a mark with a tip (a row's agent) says it in a toast
  document.addEventListener('pointerdown', (e) => {
    const el = e.pointerType !== 'mouse' && (e.target as Element).closest?.<HTMLElement>('#list [data-tip]')
    if (!el) return
    const t = setTimeout(() => {
      hint(el.dataset.tip || '')
      const eat = (ev: Event) => {
        ev.preventDefault()
        ev.stopPropagation()
      }
      addEventListener('click', eat, { capture: true, once: true })
      setTimeout(() => removeEventListener('click', eat, true), 600)
    }, 450)
    const stop = () => {
      clearTimeout(t)
      removeEventListener('pointerup', stop)
      removeEventListener('pointercancel', stop)
      removeEventListener('pointermove', move)
    }
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 8) stop()
    }
    addEventListener('pointerup', stop)
    addEventListener('pointercancel', stop)
    addEventListener('pointermove', move)
  })
  // keys
  document.addEventListener(
    'keydown',
    () => {
      if (TIP.el || TIP.t) tipHide() // any key closes the tooltip; Esc also goes on to close what is below it (B122)
    },
    true,
  )
  document.addEventListener('keydown', captureKey, true)
  document.addEventListener('keydown', deskKey)
  document.addEventListener('keydown', escapeKey)
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement
    if (t.id === 'fixWord' && e.key === 'Enter' && !e.isComposing) {
      e.preventDefault()
      void ACT['fix-add']({})
    } // T256
    if (t.id === 'subTitle' && e.key === 'Enter' && !e.isComposing) {
      e.preventDefault()
      document.querySelector<HTMLElement>('[data-act="sub-add"]')?.click()
    }
    if (
      /^e(Title|Body|Next)$/.test(t.id) &&
      e.key === 'Enter' &&
      (e.metaKey || e.ctrlKey) &&
      !e.isComposing &&
      U.editing
    ) {
      e.preventDefault()
      void ACT['edit-save']({ n: String(U.editing) })
    } // T113 A6
  })
  document.addEventListener(
    'keydown',
    (e) => {
      // Settings › Projects and the sidebar's New project: Enter makes or saves, Esc stops (F173, B131)
      const t = e.target as HTMLInputElement,
        id = t.id
      if (id === 'npName') {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault()
          void ACT['np-create']({})
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopImmediatePropagation()
          ACT['np-cancel']({})
        }
        return
      }
      if (id !== 'pNewName' && id !== 'pRename') return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        ACT[id === 'pNewName' ? 'p-new-cancel' : 'p-rename-cancel']({})
        return
      }
      if (e.key !== 'Enter' || e.isComposing) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (id === 'pNewName') return void ACT['p-create']({})
      ACT['p-rename-save']({})
    },
    true,
  )
  // F186 keys, in the draft or the phone's box: left or 1 picks the main model's word, right or 2 the other's
  document.addEventListener(
    'keydown',
    (e) => {
      const b = (e.target as Element).closest?.<HTMLElement>('[data-act="doubt-pick"]'),
        box = b?.closest<HTMLElement>('#draftText, #boxView')
      if (!b || !box || e.metaKey || e.ctrlKey || e.altKey) return
      const side = ({ ArrowLeft: 'was', 1: 'was', ArrowRight: 'alt', 2: 'alt' } as Record<string, 'was' | 'alt'>)[e.key]
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        return els.text?.focus()
      }
      if (!side) return
      e.preventDefault()
      e.stopPropagation()
      const n = [...box.querySelectorAll('[data-tog]')].indexOf(b.closest('[data-tog]') as Element),
        f = U.files[Number(b.dataset.i)],
        x = f?.doubts?.[Number(b.dataset.k)]
      if (!x) return
      doubtPick(f, x, side)
      requestAnimationFrame(() => {
        const togs = document.getElementById(box.id)?.querySelectorAll('[data-tog]')
        togs?.[n]?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true })
      })
    },
    true,
  )
  // what you type in fields that keep a draft (T113 A6, B6)
  document.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement,
      k = t.dataset?.docDraft,
      id = t.id
    if (k) U.docDrafts[k] = t.value
    if (id === 'docMd') {
      U.docText = t.value
      const key = docKey(),
        v = U.docText.trim(),
        d = docById(U.doc)
      kept('docs', (all) => {
        if (v && v !== (d ? noteText(d).trim() : '')) all[key] = U.docText as string
        else delete all[key]
      })
    }
    if (/^e(Title|Body|Next)$/.test(id)) keepItemEdit()
    if (id === 'subTitle' && U.subFor) {
      const n = U.subFor,
        v = t.value.trim()
      kept('subs', (all) => {
        if (v) all[n] = v
        else delete all[n]
      })
    }
    if (id === 'pNewName') U.pNewText = t.value
  })
  // the selection: words of a voice note can be corrected (F144); words of a document commented on (T274 #1)
  document.addEventListener('selectionchange', () => {
    const sel = getSelection(),
      text = sel?.toString().replace(/\s+/g, ' ').trim()
    // A3: the selection went before you wrote anything into the box: no more correcting
    if (
      U.correct &&
      U.correctSel &&
      !text &&
      !els.text?.value.trim() &&
      !els.composer?.contains(document.activeElement)
    ) {
      U.correctSel = false
      return cancelCorrect()
    }
    const had = U.fixCand
    U.fixCand = null
    if (text && text.length <= 60 && sel) {
      const node = sel.anchorNode,
        el = (node?.nodeType === 1 ? (node as Element) : node?.parentElement)?.closest<HTMLElement>('[data-voice]')
      const r = el && el.contains(sel.focusNode) ? byR.get(el.dataset.voice as string) : undefined
      if (r && r.text.includes(text) && !(U.correct?.id === r.id && U.correct.wrong === text))
        U.fixCand = { id: r.id, wrong: text, v: r.v || 0 } // F204
    }
    if (had !== U.fixCand) bump('vc')
  })
  document.addEventListener('selectionchange', () => {
    if (!U.doc || U.docEdit || U.docCircle) return
    const sel = getSelection(),
      text = sel?.toString().trim()
    if (!sel || !text || text.length < 2) return // a collapsed selection keeps the last quote until you comment or cancel
    const node = sel.anchorNode,
      at = node?.nodeType === 1 ? (node as Element) : node?.parentElement,
      sec = at?.closest<HTMLElement>('#docBlocks > section[data-key]')
    if (!sec || at?.closest('[data-thread]')) return // words of a comment are not the text
    U.docQuote = { key: sec.dataset.key as string, text: text.slice(0, 500) }
    U.docSel = new Set()
    U.docReply = null
    bump('composer', 'vc')
  })
  document.addEventListener('selectionchange', () => bump('vc')) // F184: the bar follows the selection
  document.addEventListener(
    'scroll',
    () => {
      if (!document.getElementById('vcBar')?.hidden) bump('vc')
    },
    true,
  )
  addEventListener('resize', () => bump('vc', 'list'))
  document.addEventListener('mouseup', (e) => {
    if ((e.target as Element).closest?.('#draftText')) setTimeout(draftFix)
  }) // I176
  document.addEventListener('click', (e) => {
    // I176: a word the model was not sure of: correct it with one click
    const u = (e.target as Element).closest?.('#draftText [data-unsure]')
    if (!u || U.fixEd) return
    const r = document.createRange()
    r.selectNodeContents(u)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(r)
    draftFix()
  })
  // the fade under a long message shows while there is more below (F93)
  document.addEventListener(
    'scroll',
    (e) => {
      const el = e.target as HTMLElement
      if (el.matches?.('[data-clip]'))
        el.toggleAttribute('data-over', el.scrollTop + el.clientHeight < el.scrollHeight - 2)
    },
    true,
  )
  // pane edges (F89)
  restoreGrips()
  document.addEventListener('pointerdown', (e) => {
    const g = desk() && (e.target as Element).closest<HTMLElement>('[data-grip]')
    if (!g || e.button || (e.target as Element).closest('button')) return // B346: a button on a line is a button
    const kind = g.dataset.grip as string,
      [id, , min, max] = GRIP[kind],
      down = kind === 'top', // T322: the line between the item and its talk moves up and down
      box = (
        down ? document.getElementById('itemTop') : id ? document.getElementById(id) : null
      )?.getBoundingClientRect(),
      from = (down ? box?.top : box?.left) || 0
    const most = down
      ? Math.min(max, document.getElementById('detailBody')?.clientHeight || max) // as far as you drag it
      : kind === 'list'
        ? Math.min(max, innerWidth - from) // as far as you drag it (T322)
        : Math.min(max, innerWidth)
    let w = 0
    e.preventDefault()
    g.setPointerCapture(e.pointerId)
    const cursor = down ? 'cursor-row-resize' : 'cursor-col-resize'
    document.body.classList.add('select-none', cursor)
    const move = (ev: PointerEvent) => {
      w = Math.round(Math.min(most, Math.max(min, (down ? ev.clientY : ev.clientX) - from)))
      setGrip(kind, w)
      if (down && U.topAll) {
        U.topAll = null
        bump('detail')
      }
    }
    const up = () => {
      g.removeEventListener('pointermove', move)
      g.removeEventListener('pointerup', up)
      document.body.classList.remove('select-none', cursor)
      if (w)
        try {
          localStorage.setItem('taska.w.' + kind, String(w))
        } catch {
          /* no storage */
        }
    }
    g.addEventListener('pointermove', move)
    g.addEventListener('pointerup', up)
  })
  document.addEventListener('dblclick', (e) => {
    const g = desk() && (e.target as Element).closest<HTMLElement>('[data-grip]')
    if (g && !(e.target as Element).closest('button')) {
      setGrip(g.dataset.grip as string, 0)
      try {
        localStorage.removeItem('taska.w.' + g.dataset.grip)
      } catch {
        /* no storage */
      }
    }
  })
  // crossing 1024px: each layout puts back what it owns
  onLayout(() => {
    if (desk()) {
      DR.open = false
      if (D.page && !D.section) D.section = 'agents'
    } else {
      D.full = false
      D.compose = false
      if (D.page) D.page = null
    }
    closeDialog()
    render()
  })
  // the phone's drawer: drag it shut, or open from what is left of the page (F54)
  const DG = { g: null as null | { x0: number; y0: number; from: number; pull?: boolean; x?: number } }
  document.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0]
      DG.g = null
      if (e.touches.length !== 1 || OV.spec || VW.open) return
      if (DR.open && (e.target as Element).closest('#drawer, #drawerShade'))
        DG.g = { x0: t.clientX, y0: t.clientY, from: drawerW() }
    },
    { passive: true },
  )
  document.addEventListener(
    'touchmove',
    (e) => {
      const g = DG.g
      if (!g || PDRAG.on) return // a project being dragged (B330) does not pull the drawer
      const t = e.touches[0],
        dx = t.clientX - g.x0,
        dy = t.clientY - g.y0
      if (!g.pull && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        DG.g = null
        return
      } // scrolling, not the drawer
      g.pull = g.pull || Math.abs(dx) > 10
      if (g.pull) setDrawer((g.x = Math.max(0, Math.min(drawerW(), g.from + dx))), false)
    },
    { passive: true },
  )
  document.addEventListener('touchend', () => {
    const g = DG.g
    DG.g = null
    if (!g?.pull) return
    if ((g.x || 0) > drawerW() * 0.7) openDrawer()
    else closeDrawer()
  })
  // another project takes the drawer's step, so Back from there comes to this page as you left it (B150)
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('#drawerList a[href]')
    if (a && !desk() && layersNow().includes('drawer') && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault()
      location.replace(a.href)
    }
  })
  addEventListener('pageshow', (e) => {
    if (e.persisted) void refresh()
    if (desk()) return // the desktop's sidebar is not a drawer: it stays (B190)
    DR.open = false
    setDrawer(0, false)
    const drawer = document.getElementById('drawer')
    if (drawer) drawer.hidden = true
    if (layersNow().includes('drawer'))
      history.replaceState({ ...history.state, layers: layersNow().filter((k) => k !== 'drawer') }, '')
  })
  // F63: swipe right on an item page to go back; the page follows the finger, the list shows underneath
  wireBackSwipe()
  // leaving and coming back
  addEventListener('beforeunload', warnUnload) // B317: only a recording still going asks first
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') micRelease()
  })
  const comeBack = () => {
    void refresh()
    void checkOthers(true)
    resendOutbox()
  } // B129, B151
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) comeBack()
  })
  addEventListener('focus', comeBack)
  addEventListener('online', () => {
    void refresh()
    resendOutbox()
  })
  addEventListener('storage', onStorage)
  addEventListener('pagehide', () => {
    // where you were in the list, for the reload (B152)
    const S = model.S
    try {
      if (S.project) sessionStorage.setItem('taska.tab.' + S.project, U.tab) // B301
    } catch {
      /* no storage */
    }
    if (desk() || !S.project) return
    const top = U.open
      ? (U.listTop || [])[U.tab === 'inputs' ? 1 : 0]
      : (U.tab === 'inputs' ? els.inputsView : els.list)?.scrollTop
    if (typeof top === 'number') U.tabTop[U.tab] = top
    try {
      sessionStorage.setItem('taska.top.' + S.project, JSON.stringify(U.tabTop))
    } catch {
      /* no storage */
    }
  })
  // the sheet sits above the input box; it follows the box whenever it changes size
  const foot = document.getElementById('foot')
  if (foot)
    new ResizeObserver(() => {
      const o = document.getElementById('overlay')
      if (o?.dataset.above && OV.spec) o.style.bottom = footRoom() + 'px'
    }).observe(foot)
  // Back and Forward
  addEventListener('popstate', () => {
    if (ownPop()) return // a step the page took back itself (B150)
    if (!location.pathname.startsWith(ctx.P)) {
      goTo(location.href, 'pop') // Back or Forward to another project: switched in the page (T339)
      return
    }
    if (URLS.selfBack) {
      URLS.selfBack = false
      return writeURL(false, history.state?.full ? history.state : null)
    } // our own step back
    if (!desk() && closeLayers() && location.pathname === layAt().split('?')[0]) return writeURL(false) // B150, B152, B301
    applyURL()
    setLayAt()
  })
  // "2m" keeps counting between changes
  setInterval(() => {
    if (model.S.agents) bump('head', 'side')
  }, 30000)
  keepChoice()
  void sleep(0)
}
// F63: the item page follows the finger to the right; the first 24px from the edge stay the phone's own back
function wireBackSwipe() {
  const BK = { on: false, pull: false, x0: 0, y0: 0, dx: 0, t0: 0 }
  const view = () => document.getElementById('detailView')
  const end = () => {
    if (!BK.pull) return
    BK.on = false
    const v = view()
    if (!v) return
    const w = v.offsetWidth,
      go = BK.dx > w * 0.3 || (BK.dx > 60 && Date.now() - BK.t0 < 300)
    v.style.transition = reduceMotion() ? 'none' : 'transform 180ms ease-out'
    v.style.transform = go ? `translateX(${w}px)` : ''
    setTimeout(() => {
      BK.pull = SWIPE.back = false
      for (const c of [
        'absolute',
        'inset-x-0',
        'top-[env(safe-area-inset-top)]',
        'z-20',
        'bg-white',
        'dark:bg-zinc-950',
        'shadow-2xl',
      ])
        v.classList.remove(c)
      v.style.bottom = ''
      v.style.transform = ''
      v.style.transition = ''
      const list = document.getElementById('itemsView'),
        head = document.getElementById('mainHead'),
        tabs = document.getElementById('tabs')
      if (go) ACT.back({})
      else for (const el of [list, head, tabs]) if (el) el.hidden = true
    }, 180)
  }
  document.addEventListener(
    'touchstart',
    (e) => {
      const v = view(),
        t = e.touches[0]
      if (!v || desk() || !v.contains(e.target as Node)) return
      BK.on =
        e.touches.length === 1 &&
        t.clientX > 24 &&
        !OV.spec &&
        !(e.target as Element).closest('.overflow-x-auto, pre, input, textarea')
      Object.assign(BK, { x0: t.clientX, y0: t.clientY, dx: 0, t0: Date.now() })
    },
    { passive: true },
  )
  document.addEventListener(
    'touchmove',
    (e) => {
      const v = view()
      if (!BK.on || !v) return
      const t = e.touches[0],
        dx = t.clientX - BK.x0,
        dy = t.clientY - BK.y0
      if (!BK.pull) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        if (dx < 0 || Math.abs(dy) > Math.abs(dx)) {
          BK.on = false
          return
        } // scrolling, or a swipe the other way
        BK.pull = SWIPE.back = true
        // the list shows underneath while the page floats above it
        const list = document.getElementById('itemsView'),
          head = document.getElementById('mainHead'),
          tabs = document.getElementById('tabs')
        if (U.tab !== 'inputs' && list) list.hidden = false
        if (head) head.hidden = false
        if (tabs) tabs.hidden = false
        if (els.list && U.listTop) els.list.scrollTop = U.listTop[0]
        for (const c of [
          'absolute',
          'inset-x-0',
          'top-[env(safe-area-inset-top)]',
          'z-20',
          'bg-white',
          'dark:bg-zinc-950',
          'shadow-2xl',
        ])
          v.classList.add(c)
        v.style.bottom = footRoom() + 'px'
        v.style.transition = 'none'
      }
      if (e.cancelable) e.preventDefault() // the page moves sideways, not up and down
      BK.dx = Math.max(0, dx)
      v.style.transform = `translateX(${BK.dx}px)`
    },
    { passive: false },
  )
  document.addEventListener('touchend', end)
  document.addEventListener('touchcancel', () => {
    BK.dx = 0
    end()
  })
}
