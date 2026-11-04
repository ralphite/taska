// Handlers for what a story cannot do itself (it needs the rest of the page, or Taska): each call shows in
// Storybook's Actions panel. Its own module, so any fixture can use it without importing the others.
import { fn } from 'storybook/test'

/** A handler that does nothing on the page but shows each call, with what it was given, in Storybook's Actions panel
 * under its name (D115 #16): a menu's rows answer a click there. A row that opens a next step (Delete asks again, Move
 * to... picks a project, Status... its choices) names that step's story, in the action's name and in the description
 * of the menu's story. */
export const act = (name: string) => fn().mockName(name)
/** A part's handlers, each an act named "<part>: <handler>", and "→ <story>" after it for one that opens a next step
 * (the story of that step). */
export const acts = <K extends string>(part: string, names: readonly K[], next: Partial<Record<K, string>> = {}) =>
  Object.fromEntries(names.map((k) => [k, act(`${part}: ${k}${next[k] ? ` → ${next[k]}` : ''}`)])) as Record<K, ReturnType<typeof act>>
