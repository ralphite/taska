// Deleted's rows: everything deleted, one list, the latest first, whatever it was (an item with its subitems, a
// document with its item, what you said with the items it had made). Pure: the container and the stories both use it.

import type { ProjectModel } from '../../model/project'
import { when } from '../../model/time'
import { inputCode, plural } from '../../model/words'
import type { GoneRow } from './SideLists'

export function goneRows(m: ProjectModel): GoneRow[] {
  const at = (t: string) => when(t, m.at)
  return [
    ...m.facts.deleted.map((x): GoneRow & { t: string } => ({
      key: x.kind === 'item' ? x.code || '' : `D${x.d}`,
      kind: x.kind,
      title: x.title,
      what: x.kind === 'item' ? `Item${x.more ? `, with ${plural(x.more, 'subitem')}` : ''}` : `Document${x.on ? ` on ${x.on}` : ''}`,
      at: at(x.at),
      t: x.at,
    })),
    ...m.facts.deletedInputs.map((x): GoneRow & { t: string } => ({
      key: x.id,
      kind: 'input',
      id: x.id,
      text: x.text || (x.files ? plural(x.files, 'file') : ''),
      code: inputCode(x.id),
      with: x.items.map((i) => i.code).join(', '),
      at: at(x.at),
      t: x.at,
    })),
  ].sort((a, b) => Date.parse(b.t) - Date.parse(a.t))
}

