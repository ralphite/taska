// What floats over the page, with the page's data: the sheet or menu the store says is open, drawn in its frame
// with what it holds (SheetKindsContainer). One that lost what it was about closes.

import { useEffect } from 'react'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useProjectModel, useProjectRoute } from '../../app/hooks'
import { Sheet } from '../../ui/Sheet'
import { useItemWorld } from '../item/ItemPageContainer'
import { sheetParts } from './SheetKindsContainer'

export function SheetContainer() {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const route = useProjectRoute()
  const spec = useStoreValue(app.stores.sheet, (s) => s.spec)
  const arm = useStoreValue(app.stores.sheet, (s) => s.arm)
  const asked = useStoreValue(app.stores.sheet, (s) => s.asked)
  const m = useProjectModel(route?.slug ?? '')
  const world = useItemWorld(m, route?.slug ?? '')
  const got = spec ? sheetParts({ app, spec, route, m, desk, arm, asked, world }) : null
  const lost = !!spec && !got && !!m
  useEffect(() => {
    if (lost) app.sheets.close()
  }, [app, lost])
  return (
    <Sheet
      open={!!spec && !!got}
      look={{ pop: spec?.pop, narrow: spec?.narrow, tall: spec?.tall, card: spec?.card, aboveComposer: spec?.aboveComposer, at: spec?.at, menu: got?.menu }}
      parts={got?.parts ?? null}
      desk={desk}
      focus={!!spec?.focus}
      onClose={() => app.sheets.close()}
    />
  )
}
