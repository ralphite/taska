// The picture viewer: the pictures of one message or box, one at a time, fit to the screen or at 100% (B140).
import { bump } from './state'
import { layerOpen, layerShut } from './url'

export const VW = { open: false, group: [] as string[], idx: 0, fit: true }
export function openViewer(group: string[], f: string) {
  VW.group = group.length ? group : [f]
  VW.idx = Math.max(0, VW.group.indexOf(f))
  VW.fit = true
  if (!VW.open) layerOpen('viewer') // Back closes it (B150)
  VW.open = true
  bump('viewer')
  requestAnimationFrame(() => document.getElementById('vClose')?.focus())
}
export function closeViewer() {
  VW.open = false
  bump('viewer')
}
export function viewerAct(what: 'close' | 'prev' | 'next' | 'zoom') {
  if (!VW.open) return
  if (what === 'close') {
    closeViewer()
    layerShut('viewer')
    return
  }
  if (what === 'prev' && VW.idx > 0) VW.idx--
  else if (what === 'next' && VW.idx < VW.group.length - 1) VW.idx++
  else if (what === 'zoom') VW.fit = !VW.fit
  else return
  if (what !== 'zoom') VW.fit = true
  bump('viewer')
}
