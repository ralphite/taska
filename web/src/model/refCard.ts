// What a code's hover card says (T12, D17, #360 in some words): its kind, state and time on top, its name, then the
// start of it.

import { shownStatus } from './items'
import { codeOf, liveN, type ProjectModel } from './project'
import { when } from './time'
import { inputCode, plural, whoName } from './words'

export interface RefCard {
  top: string
  name?: string
  gist?: string
}

/** Words in one short run, without Markdown marks. */
export const clip = (t: unknown, k: number) => {
  const s = String(t || '')
    .replace(/[#>*`_[\]()!|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > k ? s.slice(0, k) + '…' : s
}

const top = (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' · ')

export function refCard(m: ProjectModel, ref: string): RefCard | null {
  if (/^[rR#]\d+$/.test(ref)) {
    const r = m.byId.get('r' + ref.slice(1))
    if (!r) return null
    const on = r.scope != null && m.byN.get(r.scope)
    return { top: top([`Input ${inputCode(r.id)}`, r.by === 'you' ? 'You' : whoName(r.by), when(r.t, m.at), on && `on ${codeOf(m, r.scope)}`]), gist: clip(r.text || plural(r.files.length, 'file'), 220) }
  }
  if (ref[0] === 'D') {
    const d = m.docs.find((x) => x.d === Number(ref.slice(1)))
    if (!d) return null
    const on = m.byN.get(liveN(m, d.n))
    const rest = String(d.md || '')
      .split('\n')
      .slice(1)
      .filter((l) => !/^\s*#/.test(l))
      .join(' ')
    return { top: top([`Document ${ref}`, on && `on ${codeOf(m, on.n)}`, `updated ${when(d.t1 || d.t0, m.at)}`]), name: d.title || 'Untitled', gist: clip(rest, 200) }
  }
  const it = m.byN.get(Number(ref.slice(1)))
  if (!it) return null
  return { top: top([`${it.type[0].toUpperCase() + it.type.slice(1)} ${codeOf(m, it.n)}`, it.pri, shownStatus(it).label, it.archived && 'Archived']), name: it.title, gist: clip(it.body, 200) }
}
