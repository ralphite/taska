// What floats over the page: the sheet or menu the store says is open, in its frame, holding what its kind draws.
// Each feature draws its own kinds; this only picks the one for the request and frames it.

import type { ComponentType } from 'react'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import type { SheetKind, SheetRequest } from '../../stores/sheet'
import { Sheet } from '../../ui/Sheet'
import { KeysSheet, PaletteSheet, SwitchProjectSheet } from '../find/FindersContainer'
import { AsSaidSheet, InputHistorySheet, InputMenuSheet, InputMoveSheet, InputRescopeSheet } from '../inputs/InputSheetsContainer'
import { ItemMenuSheet, MessageMenuSheet, MoveItemProjectSheet, MoveParentSheet, SourcesSheet } from '../item/ItemSheetsContainer'
import { FiltersSheet } from '../list/FiltersContainer'

const KINDS: { [K in SheetKind]: ComponentType<{ req: Extract<SheetRequest, { kind: K }> }> } = {
  'item-menu': ItemMenuSheet,
  'item-move-parent': MoveParentSheet,
  'item-move-project': MoveItemProjectSheet,
  'item-sources': SourcesSheet,
  'message-menu': MessageMenuSheet,
  'input-menu': InputMenuSheet,
  'input-history': InputHistorySheet,
  'input-move': InputMoveSheet,
  'input-rescope': InputRescopeSheet,
  'as-said': AsSaidSheet,
  filters: FiltersSheet,
  keys: KeysSheet,
  'switch-project': SwitchProjectSheet,
  palette: PaletteSheet,
}

function Holds({ req }: { req: SheetRequest }) {
  const Kind = KINDS[req.kind] as ComponentType<{ req: SheetRequest }>
  return <Kind req={req} />
}

export function SheetContainer() {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const spec = useStoreValue(app.stores.sheet, (s) => s.spec)
  return (
    <Sheet open={!!spec} look={{ pop: spec?.pop, narrow: spec?.narrow, tall: spec?.tall, card: spec?.card, aboveComposer: spec?.aboveComposer, at: spec?.at }} desk={desk} focus={!!spec?.focus} onClose={() => app.sheets.close()}>
      {spec ? <Holds key={JSON.stringify(spec.req)} req={spec.req} /> : null}
    </Sheet>
  )
}
