// A document's sheets with the page's data: putting it on another item, and moving one of its comments.

import { useLayout, useServices } from '../../app/context'
import { useCloseSheetWhen, useProjectModel, useProjectRoute } from '../../app/hooks'
import { allComments } from '../../model/docs'
import { codeOf, liveN } from '../../model/project'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { pickSheet } from '../../ui/Pickers'
import { commentMenuSheet, commentMoveSheet } from './DocSheets'
import { DocEditContainer } from './DocEditContainer'

type Req<K extends SheetRequest['kind']> = { req: Extract<SheetRequest, { kind: K }> }

function useDocOf(dn: number) {
  const slug = useProjectRoute()?.slug ?? ''
  const m = useProjectModel(slug)
  const d = m?.docs.find((x) => x.d === dn)
  useCloseSheetWhen(!!m && !d)
  return { m, d }
}

export function DocMoveSheet({ req }: Req<'doc-move'>) {
  const app = useServices('docEditor', 'sheets')
  const desk = useLayout() === 'desk'
  const { m, d } = useDocOf(req.d)
  if (!m || !d) return null
  const code = (n: number) => codeOf(m, n)
  return (
    <SheetLayout
      {...pickSheet({ head: `Put D${d.d} on…`, items: m.items, skip: [liveN(m, d.n)], code, desk }, (n) => {
        app.sheets.close()
        app.docEditor.moveTo(d.d, code(n))
      })}
    />
  )
}

export function CommentMoveSheet({ req }: Req<'comment-move'>) {
  const app = useServices('docComments', 'sheets')
  const { m, d } = useDocOf(req.d)
  const c = d ? allComments(d).find((x) => x.id === req.id) : undefined
  useCloseSheetWhen(!!d && !c)
  if (!m || !d || !c) return null
  return (
    <SheetLayout
      {...commentMoveSheet(d, c.key, (key) => {
        app.sheets.close()
        if (key !== c.key) void app.docComments.moveComment(d.d, c.id, key, c.key)
      })}
    />
  )
}

/** The phone's menu of a comment: Edit (yours), Move (its own sheet), Delete (Undo puts it back). */
export function CommentMenuSheet({ req }: Req<'comment-menu'>) {
  const app = useServices('docComments', 'sheets')
  const slug = useProjectRoute()?.slug ?? ''
  const { m, d } = useDocOf(req.d)
  const c = d ? allComments(d).find((x) => x.id === req.id) : undefined
  useCloseSheetWhen(!!d && !c)
  if (!m || !d || !c) return null
  return (
    <SheetLayout
      {...commentMenuSheet(c.by === 'you', {
        edit: () => app.sheets.close(() => app.docComments.editComment(slug, d.d, c.id)),
        move: () => app.sheets.open({ kind: 'comment-move', d: d.d, id: c.id }, { focus: false }),
        remove: () => app.sheets.close(() => app.docComments.deleteComment(d.d, c.id)),
      })}
    />
  )
}

/** The editor in a sheet: the phone's, and a new document's. */
export function DocEditSheet({ req }: Req<'doc-edit'>) {
  const slug = useProjectRoute()?.slug ?? ''
  const m = useProjectModel(slug)
  const d = 'd' in req ? m?.docs.find((x) => x.d === req.d) : undefined
  useCloseSheetWhen(!!m && 'd' in req && !d)
  if (!m || ('d' in req && !d)) return null
  return <SheetLayout title={d ? `D${d.d}` : `New doc on ${codeOf(m, (req as { n: number }).n)}`} body={<DocEditContainer slug={slug} />} />
}
