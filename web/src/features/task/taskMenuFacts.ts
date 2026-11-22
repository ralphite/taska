// What a task's menu shows, from the model: the task, its code and its parent's, whether Delete asks for its second
// click, one field's choices only (from its chip, or S, P, T), the project's tags, and the keys of the desktop's rows. Pure: the
// container and the stories both use it.

import { keysShown } from '../../app/actions'
import { projectTags, waitsFor } from '../../model/tasks'
import { codeOf, type ProjectModel } from '../../model/project'
import type { Task } from '../../model/types'
import type { TaskMenuFacts } from './TaskMenu'

export const taskMenuFacts = (m: ProjectModel, it: Task, asking: boolean, arm: TaskMenuFacts['arm']): TaskMenuFacts => ({
  it,
  code: codeOf(m, it.n),
  parentCode: it.parent ? codeOf(m, it.parent) : null,
  asking,
  arm,
  keys: { edit: keysShown('edit'), copy: keysShown('copy'), newDoc: keysShown('new-doc'), addSub: keysShown('add-sub'), reparent: keysShown('put-under'), later: keysShown('later'), archive: keysShown('archive'), status: keysShown('status'), pri: keysShown('priority'), tags: keysShown('tags') },
  allTags: projectTags(m.tasks),
  waitsFor: waitsFor(m.byN, it).map((x) => codeOf(m, x.n)),
})
