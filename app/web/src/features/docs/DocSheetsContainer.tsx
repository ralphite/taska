// A document's sheets with the page's data: putting it on another item, and moving one of its comments.

import { useApp, useLayout } from '../../app/context'
import { useCloseSheetWhen, useProjectModel, useProjectRoute } from '../../app/hooks'
import { allComments } from '../../model/docs'
import { codeOf, liveN } from '../../model/project'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { pickSheet } from '../item/Pickers'
import { commentMoveSheet } from './DocSheets'

type Req<K extends SheetRequest['kind']> = { req: Extract<SheetRequest, { kind: K }> }

function useDocOf(dn: number) {
  const slug = useProjectRoute()?.slug ?? ''
  const m = useProjectModel(slug)
  const d = m?.docs.find((x) => x.d === dn)
  useCloseSheetWhen(!!m && !d)
  return { m, d }
}

export function DocMoveSheet({ req }: Req<'doc-move'>) {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const { m, d } = useDocOf(req.d)
  if (!m || !d) return null
  const code = (n: number) => codeOf(m, n)
  return (
    <SheetLayout
      {...pickSheet({ head: `Put D${d.d} on…`, items: m.items, skip: [liveN(m, d.n)], code, desk }, (n) => {
        app.sheets.close()
        app.docs.moveTo(d.d, code(n))
      })}
    />
  )
}

export function CommentMoveSheet({ req }: Req<'comment-move'>) {
  const app = useApp()
  const { m, d } = useDocOf(req.d)
  const c = d ? allComments(d).find((x) => x.id === req.id) : undefined
  useCloseSheetWhen(!!d && !c)
  if (!m || !d || !c) return null
  return (
    <SheetLayout
      {...commentMoveSheet(d, c.key, (key) => {
        app.sheets.close()
        if (key !== c.key) app.docs.moveComment(d.d, c.id, key)
      })}
    />
  )
}
