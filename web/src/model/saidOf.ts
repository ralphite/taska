// A change that did not go in, in words for the list of what was not saved: what it was ("T501 to Later"), where it
// belongs (its item, its document, the inputs), and the words it carried.

type Cmd = Record<string, unknown>

const first = (cmds: readonly unknown[]): Cmd | undefined => (cmds[0] as Cmd | undefined) ?? undefined
const inputCode = (id: string) => '#' + id.replace(/^r/, '')

export function changeWords(cmds: readonly unknown[]): string {
  const x = first(cmds)
  if (!x) return 'a change'
  const f = x.f as Record<string, unknown> | undefined
  const word = (k: string, v: unknown) =>
    k === 'when' ? (v === 'later' ? 'to Later' : 'back to now') : k === 'archived' ? (v ? 'archived' : 'out of Archive') : k === 'status' ? `marked ${String(v)}` : k === 'pri' ? `set to ${String(v)}` : k === 'rank' ? 'moved in the list' : `${k} changed`
  if (x.op === 'set' && f) return `${String(x.ref)} ${Object.entries(f).map(([k, v]) => word(k, v)).join(', ')}`
  if (x.op === 'input') return x.scope ? `your words to ${String(x.scope)}` : 'your new input'
  const on = x.on === false // the same command taking it back
  const said: Record<string, string> = {
    hide: `${on ? 'showing' : 'hiding'} a message on ${String(x.ref)}`,
    idel: `deleting ${String(x.ref)}`,
    iundel: `restoring ${String(x.ref)}`,
    delete: `deleting input ${inputCode(String(x.id))}`,
    restore: `restoring input ${inputCode(String(x.id))}`,
    ddel: `${on ? 'restoring' : 'deleting'} D${String(x.d)}`,
    dmove: `moving D${String(x.d)} to ${String(x.to)}`,
    dcres: `${on ? 'reopening' : 'resolving'} a comment on D${String(x.d)}`,
    dcdel: `deleting a comment on D${String(x.d)}`,
    dcundel: `restoring a comment on D${String(x.d)}`,
    rescope: `filing input ${inputCode(String(x.id))} under ${String(x.to)}`,
    dc: `your comment on D${String(x.d)}`,
    dcedit: `editing your comment on D${String(x.d)}`,
    dticks: `your choices in D${String(x.d)}`,
    correct: `fixing “${String(x.wrong)}” in ${inputCode(String(x.id))}`,
    amend: `${x.mode === 'edit' ? 'your edit of' : 'what you added to'} ${inputCode(String(x.id))}`,
  }
  if (said[String(x.op)]) return said[String(x.op)]
  return `${String(x.op)}${x.ref ? ' ' + String(x.ref) : ''}`
}

/** Where it belongs, to go and see it: its item, its document, or the project's inputs. */
export function changePlace(cmds: readonly unknown[], slug: string): string {
  const p = `/p/${encodeURIComponent(slug)}/`
  const x = first(cmds)
  const ref = x?.ref ?? (Array.isArray(x?.refs) ? (x.refs as unknown[])[0] : x?.scope)
  if (typeof ref === 'string' && /^[A-Z]\d+$/.test(ref)) return p + ref
  if (x?.d != null) return `${p}D${String(x.d)}`
  return x && (x.id != null || x.op === 'input') ? p + 'inputs' : p
}

/** The words it carried (what you added, a comment, a fix), in one short line. */
export function changeText(cmds: readonly unknown[]): string | undefined {
  const x = first(cmds)
  const t = String(x?.text ?? x?.right ?? '').replace(/\s+/g, ' ').trim()
  return t ? (t.length > 80 ? t.slice(0, 79) + '…' : t) : undefined
}
