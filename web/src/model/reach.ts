// Whether Taska is out of reach for the page, in one place (T728 #8): how sure the page is (`away`: its tries without
// an answer, one that timed out counting twice), the one threshold from which it says so, and the words it says it
// in. A project's sync (sync/projectSync), the home page's list of projects, a search, anything asked until Taska
// answers (api/delivery) all count the same way and say it in these words. Pure.

/** Taska is out of reach from this many: two tries without an answer, or one that timed out. */
export const AWAY = 2

/** How sure the page is after one more try without an answer (`timedOut`: it waited and nothing came). */
export const awayAfter = (away: number, timedOut: boolean) => away + (timedOut ? 2 : 1)

/** Out of reach: say so (and what waits for Taska says it waits). */
export const outOfReach = (away: number) => away >= AWAY

/** The words: where something cannot show (a list, a search, an item still to come); the header's pill, short, in
 * the agent pill's place; what of yours waits for Taska (on its way, a change asked again until Taska answers). */
export const REACH_WORDS = {
  out: 'Taska is out of reach, retrying…',
  pill: 'Out of reach, retrying…',
  waits: 'Waiting for Taska…',
} as const
