// The phone's card of one item (B153): it floats above the input box with what the item needs, its talk and its
// actions; what you do on it closes it, and the line at the bottom says what happened.
import { OV, U, bump, byN } from './state'
import { toast } from './toast'
import { closeDialog, openDialog } from './dialog'

export function peek(n: number, { focus = true } = {}) {
  if (!byN.get(n)) return
  const moved = U.peek !== n
  U.peek = n
  openDialog('peek', { n }, { aboveComposer: true, focus, card: true })
  if (moved) OV.maxH = 0
  bump('dialog', 'composer')
  if (moved) requestAnimationFrame(() => document.getElementById('dlgBody')?.scrollTo({ top: 0 }))
}
export function peekDone(said = '') {
  closeDialog()
  if (said) toast(said)
}
