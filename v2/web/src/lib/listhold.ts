// A row you just acted on stays where it was, as one quiet line with Undo, while the pointer is over the list (or for
// 3 s after a key, or a finger's tap), so the next row never slides under a second click (B124, B148). Then the list
// rearranges.
import { U, bump, desk } from './state'

export const LIST = {
  in: false,
  t: 0,
  until: 0,
  sig: '',
  at: null as null | { n: number; rows: number[] }, // the rows when the open item was last among them (T113 A14)
  frozen: null as null | number[], // the rows' order while one holds still
  openAt: null as number | null, // T438 #3: the item open when a row began holding
}
export const listSig = () => [U.tab, U.q, U.type, U.when, U.status, U.pri, U.sort].join('|')
export function holding() {
  if (!U.settle.size) return false
  if (LIST.sig !== listSig() || (desk() && U.open !== LIST.openAt)) {
    U.settle.clear()
    return false
  } // another search, filter or tab, or (T438 #3) you went on to another item: show the list as it is now
  return true
}
// each held row's height as it was drawn, so its quiet line keeps it (measured once, when it starts holding: T339)
export const ROW_H = new Map<number, number>()
export function holdRow(n: number, said: string, undo: () => unknown, f?: string, v?: unknown) {
  const row = document.querySelector<HTMLElement>(`#list article[data-n="${n}"]`)
  if (row && !U.settle.has(n)) ROW_H.set(n, row.offsetHeight)
  U.settle.set(n, { said, undo, f, v })
  LIST.sig = listSig()
  LIST.openAt = U.open
  LIST.until = Date.now() + (LIST.in ? 800 : 3000)
  clearTimeout(LIST.t)
  // T438 #3 (A11): decided in the item on the desktop, the list does not rearrange under your eyes a moment later: it
  // waits until you go on to another item, or the pointer has been over the list and leaves it
  if (desk() && !LIST.in) return
  LIST.t = window.setTimeout(releaseList, LIST.until - Date.now())
}
export function releaseList() {
  if (!U.settle.size || (LIST.in && Date.now() < LIST.until + 60000)) return // still over the list: wait until it leaves
  U.settle.clear()
  LIST.frozen = null
  bump('list')
}
export function listEnter() {
  LIST.in = true
}
export function listLeave() {
  LIST.in = false
  if (U.settle.size) {
    clearTimeout(LIST.t)
    LIST.t = window.setTimeout(releaseList, Math.max(0, LIST.until - Date.now()))
  }
}
// T438 #3 (A1): a row that holds still says what you did; once the item has moved on (an agent took it further), the
// row shows it as it is now
export function settleMoved(now: (n: number) => Record<string, unknown> | undefined) {
  for (const [n, h] of U.settle) if (h.f && JSON.stringify(now(n)?.[h.f]) !== JSON.stringify(h.v)) U.settle.delete(n)
}
