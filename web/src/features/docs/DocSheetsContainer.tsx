// A document's sheets with the page's data: putting it on another task, moving one of its comments, restoring a
// version of the rules, putting shared rules into them (I779).

import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useCloseSheetWhen, useProjectModel, useProjectRoute } from '../../app/hooks'
import { allComments } from '../../model/docs'
import { codeOf, liveN } from '../../model/project'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { pickSheet } from '../../ui/Pickers'
import { commentMenuSheet, commentMoveSheet, docMenuSheet } from './DocSheets'
import { restoreAsk } from './Rules'
import { nowVersion, rulesDoc } from '../../model/rules'
import { DocEditContainer } from './DocEditContainer'
import { InsertList } from './Include'
import { hasLine, lineOf, usedCount } from '../../model/includes'

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
      {...pickSheet({ head: `Put D${d.d} on…`, tasks: m.tasks, skip: [liveN(m, d.n)], code, desk }, (n) => {
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

/** The phone's menu of a document (D115 #41): Copy, Move (its own sheet), Mark an area, Edit, Delete (asking again). */
export function DocMenuSheet({ req }: Req<'doc-menu'>) {
  const app = useServices('docEditor', 'docs', 'sheets')
  const stores = useStores('docView', 'sheet')
  const asked = useStoreValue(stores.sheet, (s) => s.asked)
  const { m, d } = useDocOf(req.d)
  if (!m || !d) return null
  return (
    <SheetLayout
      {...docMenuSheet(`D${d.d}`, { web: d.fmt === 'html', deleting: !!asked['doc-delete ' + d.d] }, {
        copy: () => app.sheets.close(() => app.docs.copy(d.d)),
        move: () => app.sheets.open({ kind: 'doc-move', d: d.d }, { focus: false }),
        mark: () => app.sheets.close(() => stores.docView.getState().setCircle(true)),
        edit: () => app.sheets.close(() => app.docEditor.edit(d.d)),
        remove: () => app.docEditor.remove(d.d),
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

/** Restoring a version of the rules asks once: it becomes the next version (I693). */
export function RulesRestoreSheet({ req }: Req<'rules-restore'>) {
  const app = useServices('rules', 'sheets')
  const slug = useProjectRoute()?.slug ?? ''
  const d = rulesDoc(useProjectModel(slug))
  const next = (nowVersion(d)?.v ?? 0) + 1
  return <SheetLayout {...restoreAsk(req.v, next, { cancel: () => app.sheets.close(), restore: () => void app.rules.restore(req.v) })} />
}

/** Insert shared rules: each, and its sections, those the text puts in already ticked; a pick goes where the caret is. */
export function SharedInsertSheet() {
  const app = useServices('nav', 'sharedRules', 'sheets')
  const stores = useStores('docView', 'settings')
  const slug = useProjectRoute()?.slug ?? ''
  const shared = useStoreValue(stores.settings, (s) => s.shared)
  const text = useStoreValue(stores.docView, (s) => s.text) ?? ''
  const rows = shared?.map((r) => ({ name: r.name, line: lineOf(r.name), count: usedCount(r), parts: r.parts.map((p) => ({ name: p.name, line: lineOf(r.name, p.name) })) })) ?? null
  return (
    <SheetLayout
      menu
      title="Insert shared rules"
      body={<InsertList rows={rows} has={(l) => hasLine(text, l)} on={{ pick: (l) => app.sharedRules.insert(l), settings: () => app.sheets.close(() => app.nav.to(`/p/${encodeURIComponent(slug)}/shared`)) }} />}
    />
  )
}
