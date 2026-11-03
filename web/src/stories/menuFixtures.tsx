// A sheet or menu open as the page opens it: on the phone a sheet from the bottom over the page under it, on the
// desktop a menu at the button or the pointer it came from (or a sheet in the middle). What it holds is the page's own
// parts (itemMenuSheet, moveParentSheet, inputMenuSheet, ...) from the page's own facts, with the item list's demo
// project. Used by the stories of menus and sheets.
import type { ReactNode } from 'react'
import { fn } from 'storybook/test'
import { Sheet, SheetLayout, type SheetLook, type SheetParts } from '../ui/Sheet'
import { listOf, PROJECT } from './listFixtures'
import { modelOf } from './fixtures'

/** A handler that does nothing on the page but shows each call, with what it was given, in Storybook's Actions panel
 * under its name (D115 #16): a menu's rows answer a click there. A row that opens a next step (Delete asks again, Move
 * to... picks a project, Status... its choices) names that step's story, in the action's name and in the description
 * of the menu's story. */
export const act = (name: string) => fn().mockName(name)
/** A part's handlers, each an act named "<part>: <handler>", and "→ <story>" after it for one that opens a next step
 * (the story of that step). */
export const acts = <K extends string>(part: string, names: readonly K[], next: Partial<Record<K, string>> = {}) =>
  Object.fromEntries(names.map((k) => [k, act(`${part}: ${k}${next[k] ? ` → ${next[k]}` : ''}`)])) as Record<K, ReturnType<typeof act>>
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
      <Sheet open look={o.look ?? {}} desk={desk} onClose={act('Sheet: close')}><SheetLayout {...parts} /></Sheet>
    </div>
  )
}
