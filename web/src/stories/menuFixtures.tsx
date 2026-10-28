// A sheet or menu open as the page opens it: on the phone a sheet from the bottom over the page under it, on the
// desktop a menu at the button or the pointer it came from (or a sheet in the middle). What it holds is the page's own
// parts (itemMenuSheet, moveParentSheet, inputMenuSheet, ...) from the page's own facts, with the item list's demo
// project. Used by the stories of menus and sheets.
import type { ReactNode } from 'react'
import { Sheet, type SheetLook, type SheetParts } from '../ui/Sheet'
import { listOf, PROJECT } from './listFixtures'
import { modelOf } from './fixtures'

export const no = () => {}
/** The model of the item list's project used by menus. */
export const menuModel = () => modelOf(PROJECT)

/** Where the desktop's menu opens: under a button at the right of the pane's bar (its right edge at the button's, as
 * the page puts it when the window ends there: Storybook's window is wider than the frame), or at the pointer. */
export const AT_BUTTON = { x: 880 - 384, y: 56 }
export const AT_BUTTON_NARROW = { x: 880 - 224, y: 56 }
export const AT_POINTER = (x: number, y: number) => ({ x, y })

/** The page under the sheet: the item list. */
export const underList = (desk: boolean) => listOf(PROJECT, 'items', {}, desk)

export function opened(parts: SheetParts, desk: boolean, o: { under?: ReactNode; look?: SheetLook } = {}) {
  return (
    <div className="relative h-full">
      {o.under}
      <Sheet open look={o.look ?? {}} parts={parts} desk={desk} onClose={no} />
    </div>
  )
}
