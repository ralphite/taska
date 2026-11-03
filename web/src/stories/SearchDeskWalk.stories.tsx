// F479 on the desktop, a prototype: walked through, then the decisions it shows, each with the words it follows. Every
// journey: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchDesk, Tips } from './searchDesk'
import { TourFrame } from './tour/TourFrame'
import { button, gone, marked, role, shows, type Tour } from './tour/tour'

export default { title: 'Prototype/F479 Search on the desktop/Walk through' } satisfies Meta

const STOP = button('Stop and search')
const TOUR: Tour = {
  steps: [
    { say: 'Click Search (or press /).', target: button('Search') },
    { say: 'Say “where the export loses my filter”, then ↵ (or ↑).', target: STOP, until: gone(STOP) },
    { say: 'Click the right word.', target: marked('side', 'alt', { label: 'The other word' }), wait: 5000 },
    { say: 'To add more, click the mic (or ⌥V).', target: button('Say more'), until: shows(STOP) },
    { say: 'Say “only on the phone”, then ↵.', target: STOP, until: gone(STOP) },
    { say: '↵ opens the blue row, B018 (or click it; ↑↓ move the blue).', target: marked('n', 18, { label: 'B018' }), until: shows(button('Back to Search')), wait: 5000 },
    { say: 'Back to the same results (or Esc).', target: button('Back to Search'), until: shows(role('dialog')), wait: 300 },
    { say: 'Esc closes it (or the x, or a click outside).', target: button('Close'), until: gone(role('dialog')), wait: 300 },
  ],
}

/** Each desktop choice in one line, and the words it follows. */
const DECISIONS: [string, string][] = [
  ['Search is a magnifier in the sidebar’s head, left of Hide sidebar; folded, it is under the logo in the rail.', 'r796'],
  ['A click on it, or /, opens a dialog in the command palette’s sheet, 672 px wide, near the top; it grows down as results come, so its box never moves.', 'r769; the palette’s look'],
  ['It records at once. No words while you speak: the time and the level only.', 'r655, r797'],
  ['↵ or ↑ stops: Transcribing…, Searching…, then the results, in one step, by meaning.', 'the phone’s design'],
  ['The box is on top, as the palette’s field is; the kinds under it filter every project’s group; this project first.', 'the palette’s look; the phone’s design'],
  ['Typing: click the words, or just type. While it records, the first key drops the recording and the box takes the keys; ↵ searches.', '“Say or type”'],
  ['Say more: the mic in the box, or ⌥V (the box’s voice key everywhere); ↵ stops; what you added is lit at the end.', 'the phone’s design'],
  ['↑↓ walk every result, across projects (blue); the pointer lights another (grey); ↵ opens. An item’s actions show only under the pointer.', 'desktop practice'],
  ['A result opens in its project’s pane and the dialog goes; Back to Search (or Esc) brings back the same results.', 'the phone’s Back'],
  ['Esc, the x or a click outside closes it; the next search starts afresh, listening.', 'the phone’s design'],
  ['The list’s search box goes: its filter is an icon at the end of the views’ row, with no row above the views.', 'r796'],
  ['The home page’s search box goes too: a Search button in its head, and /, open this dialog.', 'r769'],
  ['⌘K stays Go to or do (commands, an item by its code); finding by meaning is this dialog’s.', 'recommended'],
]

/** Click your way through it (it never plays itself; the yellow spot is the next click): say, fix a word, say more,
 * open a result, come back, close. Under it, the desktop's choices, each with the words it follows. */
export const WalkThrough: StoryObj = {
  name: 'Walk through',
  render: () => (
    <div className="flex flex-col gap-6 bg-white p-6 dark:bg-zinc-900">
      <TourFrame layout="desk" tour={TOUR} width={1440} height={900}>
        <SearchDesk />
      </TourFrame>
      <section className="max-w-3xl text-sm text-zinc-700 dark:text-zinc-300">
        <h2 className="mb-2 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">The desktop’s choices</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {DECISIONS.map(([what, why]) => (
            <li key={what}>
              {what} <span className="text-zinc-500 dark:text-zinc-400">({why})</span>
            </li>
          ))}
        </ol>
      </section>
      <Tips />
    </div>
  ),
}
