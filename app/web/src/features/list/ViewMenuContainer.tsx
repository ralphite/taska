// One of your views' menu, with what it does.

import { useServices, useStores, useStoreValue } from '../../app/context'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { viewMenuSheet } from './ViewMenu'

export function ViewMenuSheet({ req }: { req: Extract<SheetRequest, { kind: 'view-menu' }> }) {
  const app = useServices('sheets', 'views')
  const stores = useStores('views')
  const name = useStoreValue(stores.views, (s) => s.list[req.i]?.name ?? '')
  const done = (run: () => void) => () => {
    app.sheets.close()
    run()
  }
  return (
    <SheetLayout
      {...viewMenuSheet(name, {
        rename: done(() => stores.views.getState().setEdit(req.i)),
        update: done(() => app.views.update(req.i)),
        remove: done(() => app.views.remove(req.i)),
      })}
    />
  )
}
