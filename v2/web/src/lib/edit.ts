// Editing an item's title, details and next step in place (I on the desktop, Edit on the phone). Leaving the editor
// any way but Cancel keeps what you typed (B122, T113 B6); I on that item brings it back.
import { U, byN, code, desk } from './state'
import { kept } from './drafts'
import { toast } from './toast'

const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value
export function editNow() {
  // the item editor's text, and whether it differs from the item
  const n = U.editing,
    it = n != null ? byN.get(n) : undefined
  if (!it || val('eTitle') === undefined || n == null) return null
  const d = { title: val('eTitle') ?? '', body: val('eBody') ?? '', next: val('eNext') ?? '' }
  return { n, d, changed: d.title !== it.title || d.body !== it.body || d.next !== (it.next || '') }
}
export function keepItemEdit() {
  const e = editNow()
  if (e)
    kept('edits', (all) => {
      if (e.changed) all[e.n] = e.d
      else delete all[e.n]
    })
  return e
}
export function stashEdit() {
  const e = keepItemEdit()
  if (e?.changed) toast(`Your changes to ${code(e.n)} are kept: ${desk() ? 'press I' : 'Edit'} to go on`)
}
