// The item's sheets with the page's data: its menu (a sheet on the phone, a menu at the button on the desktop),
// putting it under another item, moving it to another project, what it came from, and a message's menu.

import { copyText, forAgent } from '../../app/clipboard'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useCloseSheetWhen, useProjectModel, useProjectRoute } from '../../app/hooks'
import { codeOf, type ProjectModel } from '../../model/project'
import type { Input } from '../../model/types'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { Thumbs } from '../inputs/Files'
import { messageMenuSheet, sourcesSheet } from '../inputs/InputSheets'
import { itemMoveProjectSheet } from '../project/ProjectSheets'
import { useOtherProjects } from '../sidebar/SidebarContainer'
import { itemMenuPop, itemMenuSheet, type ItemMenuEvents } from './ItemMenu'
import { useItemWorld } from './ItemPageContainer'
import { moveParentSheet } from './Pickers'

type Req<K extends SheetRequest['kind']> = { req: Extract<SheetRequest, { kind: K }> }

/** The open project, and the item the sheet is about (closing the sheet when it went). */
function useSubject(n: number) {
  const route = useProjectRoute()
  const slug = route?.slug ?? ''
  const m = useProjectModel(slug)
  const it = m?.byN.get(n)
  useCloseSheetWhen(!!m && !it)
  const code = (k: number) => (m ? codeOf(m, k) : '')
  return { route, slug, m, it, code }
}

export function ItemMenuSheet({ req }: Req<'item-menu'>) {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const { route, slug, m, it, code } = useSubject(req.n)
  const storeArm = useStoreValue(app.stores.sheet, (s) => s.arm)
  const at = useStoreValue(app.stores.sheet, (s) => s.spec?.at)
  const asking = useStoreValue(app.stores.sheet, (s) => !!s.asked['item-delete ' + req.n])
  const others = useOtherProjects(slug)
  if (!m || !it) return null
  const n = it.n
  const close = () => app.sheets.close()
  const done = (run: () => void) => () => (close(), run())
  const on: ItemMenuEvents = {
    edit: done(() => {
      app.nav.openItem(code(n))
      app.stores.itemView.getState().setEditing(n)
    }),
    copy: done(() => void copyText(forAgent(it, code(n), m.facts.base)).then(() => app.toasts.show('Copied'))),
    newDoc: done(() => {}),
    addSub: done(() => {
      app.nav.openItem(code(n))
      app.stores.itemView.getState().setSubFor(n)
    }),
    reparent: () => app.sheets.open({ kind: 'item-move-parent', n }, { pop: desk, focus: false, at }),
    later: done(() => void app.items.change(n, 'when', it.when === 'now' ? 'later' : 'now')),
    archive: (on) => {
      close()
      void app.items.change(n, 'archived', on, { note: on ? 'Find it under Archive' : '' })
      if (on && route?.place.kind === 'item') app.nav.closeItem()
    },
    doNext: done(() => void app.items.doNext(n)),
    moveProject: () => (others.length ? app.sheets.open({ kind: 'item-move-project', n }, { focus: false }) : (close(), app.toasts.show('No other project to move to'))),
    remove: () => {
      if (!app.sheets.confirm('item-delete ' + n)) return
      close()
      void app.items.remove(n)
      if (route?.place.kind === 'item') app.nav.closeItem()
    },
    set: (f, v) => {
      if (req.arm || storeArm) close()
      void app.items.change(n, f, v)
    },
  }
  const facts = { it, code: code(n), parentCode: it.parent ? code(it.parent) : null, asking, arm: req.arm ?? storeArm }
  return desk ? <SheetLayout {...itemMenuPop(facts, on)} /> : <SheetLayout {...itemMenuSheet(facts, on)} />
}

export function MoveParentSheet({ req }: Req<'item-move-parent'>) {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const { m, it, code } = useSubject(req.n)
  if (!m || !it) return null
  return <SheetLayout {...moveParentSheet({ it, items: m.items, kids: m.kids, code, desk }, (to) => (app.sheets.close(), void app.items.change(it.n, 'parent', to)))} />
}

export function MoveItemProjectSheet({ req }: Req<'item-move-project'>) {
  const app = useApp()
  const { slug, m, it, code } = useSubject(req.n)
  const others = useOtherProjects(slug)
  if (!m || !it) return null
  return (
    <SheetLayout
      {...itemMoveProjectSheet({ code: code(it.n), others }, (to) => {
        app.sheets.close()
        void app.moves.item(slug, it.n, to)
      })}
    />
  )
}

const sourcesOf = (m: ProjectModel, srcs: readonly string[]) => srcs.map((id) => m.byId.get(id)).filter((r): r is Input => !!r && r.kind !== 'answer')

export function SourcesSheet({ req }: Req<'item-sources'>) {
  const app = useApp()
  const { slug, m, it, code } = useSubject(req.n)
  const world = useItemWorld(m, slug)
  if (!m || !it) return null
  return (
    <SheetLayout
      {...sourcesSheet(
        {
          code: code(it.n),
          inputs: sourcesOf(m, it.srcs),
          world,
          now: m.at,
          files: (f) => <Thumbs files={f} url={world.url} play={() => ({ playing: false, t: null })} tidy on={{ play() {}, words() {}, view() {} }} />,
        },
        () => app.sheets.close(),
      )}
    />
  )
}

export function MessageMenuSheet({ req }: Req<'message-menu'>) {
  const app = useApp()
  const { m, it } = useSubject(req.n)
  if (!m || !it) return null
  const hide = () => {
    app.sheets.close()
    void app.items.hideMessage(it.n, req.id)
  }
  return <SheetLayout {...messageMenuSheet(hide)} />
}
