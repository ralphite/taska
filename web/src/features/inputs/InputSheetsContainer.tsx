// An input's sheets with the page's data: its menu, its versions, moving it to another project, putting it with
// another item, and a voice note's words as said.

import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useCloseSheetWhen, useItemWorld, useProjectModel, useProjectRoute } from '../../app/hooks'
import { codeOf } from '../../model/project'
import { inputCode } from '../../model/words'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { pickSheet } from '../../ui/Pickers'
import { moveInputSheet } from '../../ui/ProjectSheets'
import { useOtherProjects } from '../../app/projectLists'
import { asSaidSheet, historySheet, inputMenuSheet } from './InputSheets'
import { inputDeleteAsk, inputMenuFacts, inputMoveFacts } from './inputSheetFacts'

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
  const desk = useLayout() === 'desk'
  const app = useServices('box', 'inputActions', 'media', 'sheets')
  const stores = useStores('settings', 'sheet')
  const { slug, m, r } = useSubject(req.id)
  const asked = useStoreValue(stores.sheet, (s) => s.asked)
  const tidy = useStoreValue(stores.settings, (s) => s.prefs?.tidy !== false)
  const others = useOtherProjects(slug)
  if (!m || !r) return null
  const id = r.id
  const close = () => app.sheets.close()
  const done = (run: () => void) => () => (close(), run())
  const facts = inputMenuFacts(m, r, others.length, asked, desk, tidy)
  return (
    <SheetLayout
      {...inputMenuSheet(facts, {
        send: done(() => app.inputActions.sendCancelled(slug, id)),
        edit: done(() => app.box.amendStart(slug, m, id, 'edit')),
        append: done(() => app.box.amendStart(slug, m, id, 'append')),
        asSaid: (f) => app.media.words(slug, f),
        undo: done(() => app.inputActions.undoFiling(slug, id)),
        move: () => app.sheets.open({ kind: 'input-move', id }),
        history: () => app.sheets.open({ kind: 'input-history', id }),
        rescope: () => app.sheets.open({ kind: 'input-rescope', id }, { focus: false }),
        takeOff: (f) => {
          if (!app.sheets.confirm(`unfile ${id} ${f}`)) return
          close()
          app.inputActions.takeOff(slug, id, f)
        },
        remove: () => {
          if (!app.sheets.confirm(inputDeleteAsk(id))) return
          close()
          app.inputActions.remove(slug, id)
        },
      })}
    />
  )
}

export function InputHistorySheet({ req }: Req<'input-history'>) {
  const { slug, m, r } = useSubject(req.id)
  const world = useItemWorld(m, slug)
  return m && r ? <SheetLayout {...historySheet(r, m.at, world)} /> : null
}

export function InputMoveSheet({ req }: Req<'input-move'>) {
  const app = useServices('inputActions', 'sheets')
  const { slug, m, r } = useSubject(req.id)
  const others = useOtherProjects(slug)
  if (!m || !r) return null
  return (
    <SheetLayout
      {...moveInputSheet(
        { ...inputMoveFacts(m, r), others },
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
  return <SheetLayout {...asSaidSheet(req.heard, req.tr, req.steps)} />
}
