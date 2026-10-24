// What floats over the page, with the page's data: the sheet or menu the store says is open, drawn in its frame
// with what it holds, and what each of its buttons does.

import { useApp, useLayout, useStoreValue } from '../../app/context'
import { copyText, forAgent } from '../../app/clipboard'
import { useProjectRoute } from '../../app/hooks'
import { codeOf } from '../../model/project'
import { Sheet, type SheetParts } from '../../ui/Sheet'
import { itemMenuPop, itemMenuSheet, type ItemMenuEvents } from './ItemMenu'

export function SheetContainer() {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const route = useProjectRoute()
  const spec = useStoreValue(app.stores.sheet, (s) => s.spec)
  const arm = useStoreValue(app.stores.sheet, (s) => s.arm)
  const asked = useStoreValue(app.stores.sheet, (s) => s.asked)
  const slug = route?.slug ?? ''
  const m = slug ? app.model(slug) : null
  const close = () => app.sheets.close()
  let parts: SheetParts | null = null
  let menu = false
  if (spec && m && (spec.kind === 'menu' || spec.kind === 'menu-desk')) {
    const n = Number(spec.props.n)
    const it = m.byN.get(n)
    if (it) {
      const code = codeOf(m, n)
      const done = (run: () => void) => () => (close(), run())
      const on: ItemMenuEvents = {
        edit: done(() => {
          app.nav.openItem(code)
          app.stores.itemView.getState().setEditing(n)
        }),
        copy: done(() => void copyText(forAgent(it, code, m.facts.base)).then(() => app.toasts.show('Copied'))),
        newDoc: done(() => {}),
        addSub: done(() => {
          app.nav.openItem(code)
          app.stores.itemView.getState().setSubFor(n)
        }),
        reparent: done(() => {}),
        later: done(() => void app.items.change(n, 'when', it.when === 'now' ? 'later' : 'now')),
        archive: (on) => {
          close()
          void app.items.change(n, 'archived', on, { note: on ? 'Find it under Archive' : '' })
          if (on && route?.place.kind === 'item') app.nav.closeItem()
        },
        doNext: done(() => void app.items.doNext(n)),
        moveProject: done(() => {}),
        remove: () => {
          if (!app.sheets.confirm('item-delete ' + n)) return
          close()
          void app.items.remove(n)
          if (route?.place.kind === 'item') app.nav.closeItem()
        },
        set: (f, v) => {
          if (arm || spec.kind === 'menu-desk') {
            if (arm) close()
          }
          void app.items.change(n, f, v)
        },
      }
      const facts = { it, code, parentCode: it.parent ? codeOf(m, it.parent) : null, asking: !!asked['item-delete ' + n], arm: (spec.props.arm as 's' | 'p' | 't' | null) ?? arm }
      parts = spec.kind === 'menu-desk' ? itemMenuPop(facts, on) : itemMenuSheet(facts, on)
      menu = spec.kind === 'menu-desk'
    }
  }
  return (
    <Sheet
      open={!!spec && !!parts}
      look={{ pop: spec?.pop, narrow: spec?.narrow, tall: spec?.tall, card: spec?.card, aboveComposer: spec?.aboveComposer, at: spec?.at, menu }}
      parts={parts}
      desk={desk}
      focus={!!spec?.focus}
      onClose={close}
    />
  )
}
