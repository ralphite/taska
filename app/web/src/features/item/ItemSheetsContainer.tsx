// The item's sheets with the page's data: its menu (a sheet on the phone, a menu at the button on the desktop),
// putting it under another item, moving it to another project, what it came from, and a message's menu.

import { useLayoutEffect } from 'react'
import { keysShown, type ActionId } from '../../app/actions'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useCloseSheetWhen, useFiles, useProjectModel, useProjectRoute } from '../../app/hooks'
import { codeOf, type ProjectModel } from '../../model/project'
import type { Input } from '../../model/types'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { Thumbs } from '../../ui/Files'
import { messageMenuSheet, sourcesSheet } from './ItemSheets'
import { itemMoveProjectSheet } from '../../ui/ProjectSheets'
import { useOtherProjects } from '../../app/projectLists'
import { itemMenuPop, itemMenuSheet, type ItemMenuEvents } from './ItemMenu'
import { useItemWorld } from '../../app/hooks'
import { moveParentSheet } from '../../ui/Pickers'

type Req<K extends SheetRequest['kind']> = { req: Extract<SheetRequest, { kind: K }> }

const FIELD_OF = { s: 'status', p: 'pri', t: 'type' } as const

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
  const app = useServices('actions', 'fields', 'items', 'nav', 'sheets', 'toasts')
  const stores = useStores('sheet')
  const desk = useLayout() === 'desk'
  const { route, slug, m, it, code } = useSubject(req.n)
  const storeArm = useStoreValue(stores.sheet, (s) => s.arm)
  const at = useStoreValue(stores.sheet, (s) => s.spec?.at)
  const asking = useStoreValue(stores.sheet, (s) => !!s.asked['item-delete ' + req.n])
  const others = useOtherProjects(slug)
  const arm = req.arm ?? storeArm
  useLayoutEffect(() => {
    // the desktop's menu: the keys start on its first row (one field's: on the value it has)
    const box = desk ? app.fields.get('sheet') : null
    if (!box || box.contains(document.activeElement)) return
    const f = arm ? FIELD_OF[arm] : null
    const el = (f && (box.querySelector<HTMLElement>(`[data-f="${f}"][aria-pressed="true"]`) || box.querySelector<HTMLElement>(`[data-f="${f}"]`))) || box.querySelector<HTMLElement>('button')
    el?.focus({ preventScroll: true })
  })
  if (!m || !it) return null
  const n = it.n
  const close = () => app.sheets.close()
  const done = (run: () => void) => () => (close(), run())
  // what the table of actions does, on this item (it may not be the open one)
  const run = (id: ActionId) => app.actions.runOn(id, n)
  const on: ItemMenuEvents = {
    edit: done(() => {
      app.nav.openItem(code(n))
      run('edit')
    }),
    copy: done(() => run('copy')),
    newDoc: done(() => run('new-doc')),
    addSub: done(() => {
      app.nav.openItem(code(n))
      run('add-sub')
    }),
    reparent: (from) => (desk && from ? app.sheets.openFrom(from, { kind: 'item-move-parent', n }, { focus: false }) : app.sheets.open({ kind: 'item-move-parent', n }, { pop: desk, focus: false, at })),
    later: done(() => run('later')),
    archive: done(() => run('archive')),
    doNext: done(() => void app.items.doNext(n)),
    moveProject: () => (others.length ? app.sheets.open({ kind: 'item-move-project', n }, { focus: false }) : (close(), app.toasts.show('No other project to move to'))),
    remove: () => {
      if (!app.sheets.confirm('item-delete ' + n)) return
      close()
      void app.items.remove(n)
      if (route?.place.kind === 'item') app.nav.closeItem()
    },
    set: (f, v) => {
      if (arm) close()
      void app.items.change(n, f, v)
    },
  }
  const keys = { edit: keysShown('edit'), copy: keysShown('copy'), newDoc: keysShown('new-doc'), addSub: keysShown('add-sub'), reparent: keysShown('put-under'), later: keysShown('later'), archive: keysShown('archive') }
  const facts = { it, code: code(n), parentCode: it.parent ? code(it.parent) : null, asking, arm, keys }
  return desk ? <SheetLayout {...itemMenuPop(facts, on)} /> : <SheetLayout {...itemMenuSheet(facts, on)} />
}

export function MoveParentSheet({ req }: Req<'item-move-parent'>) {
  const app = useServices('items', 'sheets')
  const desk = useLayout() === 'desk'
  const { m, it, code } = useSubject(req.n)
  if (!m || !it) return null
  return <SheetLayout {...moveParentSheet({ it, items: m.items, kids: m.kids, code, desk }, (to) => (app.sheets.close(), void app.items.change(it.n, 'parent', to)))} />
}

export function MoveItemProjectSheet({ req }: Req<'item-move-project'>) {
  const app = useServices('moves', 'sheets')
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
  const app = useServices('nav', 'sheets')
  const stores = useStores('ui')
  const { slug, m, it, code } = useSubject(req.n)
  const world = useItemWorld(m, slug)
  const media = useFiles(slug)
  const desk = useLayout() === 'desk'
  if (!m || !it) return null
  return (
    <SheetLayout
      {...sourcesSheet(
        {
          code: code(it.n),
          inputs: sourcesOf(m, it.srcs),
          world,
          now: m.at,
          files: (f) => <Thumbs files={f} url={world.url} play={media.play} tidy={media.tidy} on={media.on} />,
        },
        // the phone's Inputs lights it where its list is (the sheet's closing takes the list back to its top), as it
        // always has
        (id) => app.sheets.close(() => app.nav.goInput(id, (x) => stores.ui.getState().setLit(x, !desk))),
      )}
    />
  )
}

export function MessageMenuSheet({ req }: Req<'message-menu'>) {
  const app = useServices('items', 'sheets')
  const { m, it } = useSubject(req.n)
  if (!m || !it) return null
  const hide = () => {
    app.sheets.close()
    void app.items.hideMessage(it.n, req.id)
  }
  return <SheetLayout {...messageMenuSheet(hide)} />
}
