// An input's sheets with the page's data: its menu, its versions, moving it to another project, putting it with
// another item, and a voice note's words as said.

import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useCloseSheetWhen, useProjectModel, useProjectRoute } from '../../app/hooks'
import { canUndoFiling, organizing } from '../../model/inputs'
import { codeOf } from '../../model/project'
import { inputCode } from '../../model/words'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { pickSheet } from '../item/Pickers'
import { moveInputSheet } from '../project/ProjectSheets'
import { useOtherProjects } from '../sidebar/SidebarContainer'
import { asSaidSheet, historySheet, inputMenuSheet } from './InputSheets'

type Req<K extends SheetRequest['kind']> = { req: Extract<SheetRequest, { kind: K }> }

/** The open project, and the input the sheet is about (closing the sheet when it went). */
function useSubject(id: string) {
  const route = useProjectRoute()
  const slug = route?.slug ?? ''
  const m = useProjectModel(slug)
  const r = m?.byId.get(id)
  useCloseSheetWhen(!!m && !r)
  const code = (n: number) => (m ? codeOf(m, n) : '')
  return { slug, m, r, code }
}

export function InputMenuSheet({ req }: Req<'input-menu'>) {
  const app = useServices('api', 'box', 'inputActions', 'sheets')
  const stores = useStores('sheet')
  const desk = useLayout() === 'desk'
  const { slug, m, r, code } = useSubject(req.id)
  const asked = useStoreValue(stores.sheet, (s) => s.asked)
  const others = useOtherProjects(slug)
  if (!m || !r) return null
  const id = r.id
  const close = () => app.sheets.close()
  const done = (run: () => void) => () => (close(), run())
  const busy = organizing(r, m.facts.organizer)
  const facts = {
    r,
    tidy: true,
    undo: canUndoFiling(r) ? { tip: `${inputCode(id)}: ${r.filing?.what || ''}` } : null,
    move: others.length > 0 && !busy,
    history: !!r.history?.length,
    scope: r.scope ? code(r.scope) : null,
    asking: r.files.find((f) => asked[`unfile ${id} ${f.f}`])?.f ?? null,
    deleteTip:
      `Delete ${inputCode(id)}` +
      (r.deletion?.go.length ? ` and ${r.deletion.go.map(code).join(', ')}` : '') +
      (r.deletion?.keep.length ? `; ${r.deletion.keep.map(([n, why]) => `${code(n)} stays: ${why}`).join('; ')}` : ''),
  }
  return (
    <SheetLayout
      {...inputMenuSheet(facts, {
        edit: done(() => app.box.amendStart(slug, m, id, 'edit')),
        append: done(() => app.box.amendStart(slug, m, id, 'append')),
        asSaid: (f) =>
          void app.api
            .words(slug, f)
            .catch(() => app.api.words(slug, f, true))
            .then((w) => app.sheets.open({ kind: 'as-said', heard: w.heard || '', tr: w.tr || '' }, desk ? { pop: true, focus: false } : {})),
        undo: done(() => app.inputActions.undoFiling(slug, id)),
        move: () => app.sheets.open({ kind: 'input-move', id }),
        history: () => app.sheets.open({ kind: 'input-history', id }),
        rescope: () => app.sheets.open({ kind: 'input-rescope', id }, { focus: false }),
        takeOff: (f) => {
          if (!app.sheets.confirm(`unfile ${id} ${f}`)) return
          close()
          app.inputActions.takeOff(slug, id, f)
        },
        remove: done(() => app.inputActions.remove(slug, id)),
      })}
    />
  )
}

export function InputHistorySheet({ req }: Req<'input-history'>) {
  const { m, r } = useSubject(req.id)
  return m && r ? <SheetLayout {...historySheet(r, m.at)} /> : null
}

export function InputMoveSheet({ req }: Req<'input-move'>) {
  const app = useServices('inputActions', 'sheets')
  const { slug, m, r, code } = useSubject(req.id)
  const others = useOtherProjects(slug)
  if (!m || !r) return null
  const made = r.touched.filter((n) => n !== r.scope && m.byN.has(n) && !m.byN.get(n)?.archived)
  return (
    <SheetLayout
      {...moveInputSheet(
        {
          code: inputCode(r.id),
          words: r.text || `${r.files.length} file${r.files.length === 1 ? '' : 's'}`,
          others,
          made: made.map((n) => `${code(n)} ${m.byN.get(n)?.title}`),
          byOrganizer: !!(r.org && r.org.ok && !r.org.undone && !r.org.keep),
          scope: r.scope && m.byN.has(r.scope) ? code(r.scope) : null,
        },
        (to) => void app.inputActions.move(slug, r.id, to).then((ok) => ok && app.sheets.close()),
      )}
    />
  )
}

export function InputRescopeSheet({ req }: Req<'input-rescope'>) {
  const app = useServices('inputActions', 'sheets')
  const desk = useLayout() === 'desk'
  const { slug, m, r, code } = useSubject(req.id)
  if (!m || !r) return null
  const was = r.scope ? code(r.scope) : null
  return (
    <SheetLayout
      {...pickSheet({ head: `Put ${inputCode(r.id)} with…`, items: m.items, skip: r.scope ? [r.scope] : [], code, desk }, (n) => {
        app.sheets.close()
        app.inputActions.rescope(slug, r.id, code(n), was)
      })}
    />
  )
}

export function AsSaidSheet({ req }: Req<'as-said'>) {
  return <SheetLayout {...asSaidSheet(req.heard, req.tr)} />
}
