// What floats over the page: the sheet or menu the store says is open, in its frame, holding what its kind draws.
// Each feature draws its own kinds; this only picks the one for the request and frames it.

import type { ComponentType } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../app/context'
import type { SheetKind, SheetRequest } from '../stores/sheet'
import { Sheet } from '../ui/Sheet'
import { usePaneRef } from '../app/panes'
import { KeysSheet, PaletteSheet, SwitchProjectSheet } from '../features/find/FindersContainer'
import { AsSaidSheet, InputHistorySheet, InputMenuSheet, InputMoveSheet, InputRescopeSheet } from '../features/inputs/InputSheetsContainer'
import { ItemMenuSheet, MessageMenuSheet, MoveItemProjectSheet, MoveParentSheet, SourcesSheet } from '../features/item/ItemSheetsContainer'
import { FiltersSheet } from '../features/list/FiltersContainer'
import { ViewMenuSheet } from '../features/list/ViewMenuContainer'
import { SignInSheet } from '../features/project/SignInContainer'
import { NotSavedSheet, ProjectMenuSheet } from '../features/project/ProjectSheetsContainer'
import { CommentMoveSheet, DocEditSheet, DocMoveSheet } from '../features/docs/DocSheetsContainer'

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
  'doc-move': DocMoveSheet,
  'comment-move': CommentMoveSheet,
  'doc-edit': DocEditSheet,
  'view-menu': ViewMenuSheet,
  'sign-in': SignInSheet,
  'project-menu': ProjectMenuSheet,
  'not-saved': NotSavedSheet,
}

function Holds({ req }: { req: SheetRequest }) {
  const Kind = KINDS[req.kind] as ComponentType<{ req: SheetRequest }>
  return <Kind req={req} />
}

export function SheetContainer() {
  const app = useServices('docs', 'fields', 'sheets')
  const stores = useStores('sheet')
  const sheetFoot = usePaneRef('sheetFoot')
  const desk = useLayout() === 'desk'
  const spec = useStoreValue(stores.sheet, (s) => s.spec)
  return (
    <Sheet footRef={sheetFoot} open={!!spec} look={{ pop: spec?.pop, narrow: spec?.narrow, tall: spec?.tall, card: spec?.card, aboveComposer: spec?.aboveComposer, at: spec?.at }} desk={desk} focus={!!spec?.focus} bodyRef={app.fields.ref('sheet')} onClose={() => (spec?.req.kind === 'doc-edit' ? app.docs.keep() : app.sheets.close())}>
      {spec ? <Holds key={JSON.stringify(spec.req)} req={spec.req} /> : null}
    </Sheet>
  )
}
