// One of your views' menu, with what it does.

import { useApp, useStoreValue } from '../../app/context'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { viewMenuSheet } from './ViewMenu'

export function ViewMenuSheet({ req }: { req: Extract<SheetRequest, { kind: 'view-menu' }> }) {
  const app = useApp()
  const name = useStoreValue(app.stores.views, (s) => s.list[req.i]?.name ?? '')
  const done = (run: () => void) => () => {
    app.sheets.close()
    run()
  }
  return (
    <SheetLayout
      {...viewMenuSheet(name, {
        rename: done(() => app.stores.views.getState().setEdit(req.i)),
        update: done(() => app.views.update(req.i)),
        remove: done(() => app.views.remove(req.i)),
      })}
    />
  )
}
