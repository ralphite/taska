// Every sheet: a handle, a title row (or `head`), optional `extra` buttons beside the close button, an optional `sub`
// line under it and a fixed `foot`. The focus card (`card`) floats above the input box instead; `pop` is a menu at a
// spot on the desktop. One at a time; the Dialog component draws OV.spec.
import { OV, U, bump, desk, type DialogOpts } from './state'
import { layerOpen, layerShut, leaveView, writeURL } from './url'
import { keepDoc } from './docs'

export function openDialog(kind: string, props: Record<string, unknown> = {}, opts: DialogOpts = {}) {
  if (!OV.spec && !U.doc) layerOpen('sheet') // one step Back closes it (B150); a document has its own address
  const was = OV.spec
  OV.spec = { focus: true, ...opts, kind, props }
  if (!was || !opts.pop || was.kind !== kind) OV.popXY = null
  OV.popRight = false
  const a = OV.anchor
  if (opts.pop && !OV.popXY && a && Date.now() - a.t < 500) {
    // B358: opened from a button: under it, its right edge on the button's
    OV.popXY = [a.r[2], a.r[3] + 4]
    OV.popRight = true
    OV.popTop = a.r[1]
    OV.popLeft = a.r[0]
  }
  OV.maxH = 0
  bump('dialog', 'composer', 'toast')
}
/** A menu opened by right-click sits at the pointer, kept on screen (B129). */
export function popAt(x: number, y: number) {
  OV.popXY = [x, y]
  OV.popRight = false
  bump('dialog')
}
export function closeDialog() {
  const edit = U.docEdit
  OV.maxH = 0
  if (edit) keepDoc() // closing the editor keeps what you wrote, as a draft (T113 B6)
  if (desk()) {
    // a document lives in the item pane (T110): closing a sheet or the editor leaves it open there
    U.docNew = null
    U.docEdit = false
    U.sheet = null
    U.menuArm = null
    OV.spec = null
    if (U.peek) U.peek = null
    bump()
    return
  }
  const hadDoc = U.doc,
    sheet = !!OV.spec && !hadDoc
  if (hadDoc) U.docType = false // I285: the box is back once the document closes
  U.doc = null
  U.docNew = null
  U.docEdit = false
  U.sheet = null
  U.go = null
  U.docReply = null
  OV.spec = null
  U.menuArm = null
  if (U.peek) U.peek = null
  else if (hadDoc) {
    if (!leaveView(`D${hadDoc}`)) writeURL(false)
  } // the box goes back to the item or the project
  if (sheet) layerShut('sheet') // its step in the history goes too (B150)
  bump()
}
export const dialogOpen = () => !!OV.spec

// A second click within 3 s confirms (B127, B131): the page asks in place, never in a browser dialog.
const ARMED = new Map<string, number>()
export function confirmClick(key: string) {
  const t = ARMED.get(key),
    now = Date.now()
  if (t && now - t < 3000) {
    ARMED.delete(key)
    return true
  }
  ARMED.set(key, now)
  setTimeout(() => {
    // T529: only this ask ends here; a newer one for the same key keeps its own 3 s
    if (ARMED.get(key) === now) {
      ARMED.delete(key)
      bump()
    }
  }, 3000)
  bump()
  return false
}
export const armed = (key: string) => {
  const t = ARMED.get(key)
  return !!t && Date.now() - t < 3000
}
