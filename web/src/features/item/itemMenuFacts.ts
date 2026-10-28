// What an item's menu shows, from the model: the item, its code and its parent's, whether Delete asks for its second
// click, one field's choices only (from its chip, or S, P, T), and the keys of the desktop's rows. Pure: the
// container and the stories both use it.

import { keysShown } from '../../app/actions'
import { codeOf, type ProjectModel } from '../../model/project'
import type { Item } from '../../model/types'
import type { ItemMenuFacts } from './ItemMenu'

export const itemMenuFacts = (m: ProjectModel, it: Item, asking: boolean, arm: ItemMenuFacts['arm']): ItemMenuFacts => ({
  it,
  code: codeOf(m, it.n),
  parentCode: it.parent ? codeOf(m, it.parent) : null,
  asking,
  arm,
  keys: { edit: keysShown('edit'), copy: keysShown('copy'), newDoc: keysShown('new-doc'), addSub: keysShown('add-sub'), reparent: keysShown('put-under'), later: keysShown('later'), archive: keysShown('archive') },
})
