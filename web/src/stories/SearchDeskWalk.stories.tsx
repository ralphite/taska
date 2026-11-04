// F479 on the desktop, a prototype: walked through, then the decisions it shows, each with what it follows. Every
// journey: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchDesk, Tips } from './searchDesk'
import { TourFrame } from './tour/TourFrame'
import { button, gone, marked, role, shows, type Tour } from './tour/tour'

export default { title: 'Prototype/F479 Search on the desktop/Walk through' } satisfies Meta

const STOP = button('Stop and search')
const DIALOG = role('dialog')
const CHIPS = marked('chips', undefined, { label: 'The filters' })
const TOUR: Tour = {
  steps: [
    { say: 'Click Search (or press ⌘K).', target: button('Search'), until: shows(DIALOG) },
    { say: 'Type “export filter”.', target: role('textbox', 'What to find'), until: shows(marked('found', undefined, { label: 'Results' })), wait: 20000 },
    { say: 'Press ↓ (or point at #8): the preview follows.', target: marked('found', 'shop/r8', { label: '#8' }), until: shows(marked('preview', 'inputs', { label: 'The preview' })), wait: 300 },
    { say: 'Click Items.', target: button(/^Items/, { within: CHIPS, label: 'Items' }) },
    { say: 'Press ↓ then ↵ to open F003 (or click it).', target: marked('found', 'shop/i3', { label: 'F003' }), until: gone(DIALOG), wait: 300 },
    { say: 'Search again: the same words, selected.', target: button('Search'), until: shows(DIALOG) },
    { say: 'Click the mic (or ⌥V) to say it instead.', target: button('Speak'), until: shows(STOP) },
    { say: 'Say “where the export loses my filter”, then ↵.', target: STOP, until: gone(STOP) },
    { say: 'Click the right word.', target: marked('side', 'alt', { label: 'The other word' }), wait: 5000 },
    { say: 'To add more, click the mic (or ⌥V).', target: button('Speak'), until: shows(STOP), wait: 5000 },
    { say: 'Say “only on the phone”, then ↵.', target: STOP, until: gone(STOP) },
    { say: 'Esc closes it (or a click outside).', until: gone(DIALOG), wait: 300 },
  ],
}

/** Each desktop choice in one line, and what it follows. */
const DECISIONS: [string, string][] = [
  ['Search is a magnifier right of the Taska logo in the sidebar’s head (its tip: Search · ⌘K). Folded, a magnifier under the logo.', 'F479, 11-04'],
  ["⌘K (or /) opens it anywhere and closes it again; ⌘K's commands come in it as Actions when the words name one (Done F001, Settings).", 'Notion: ⌘K is search'],
  ['A wide modal in the top third over the dimmed page: min(72rem, 92% of the window), about 1150 px at 1440, so the list and the preview both have room; its height fixed so nothing jumps.', 'F479, 11-04'],
  ['Its top is a large field with the focus: typing is the default. Nothing typed: Recent.', 'Notion; “Say or type”'],
  ['Results come as you type (a pause first), best first, the words found lit; the spinner sits in the field while it searches again.', 'Notion; the phone: by meaning'],
  ['One list, best first; each row shows its project (and the item it is on) as a path. Grouping by project would put a weaker match in this project above a better one elsewhere; the Project filter narrows instead.', "Notion's page path"],
  ['Under the field: the kinds with their counts, then Project and Status (Open, Finished).', "Notion's filters"],
  ["The highlighted row's preview on the right, read only, drawn by the page that opens it (an item, a document, an input).", "Notion's preview"],
  ["↑↓ or the pointer move the highlight; ↵ opens in its project's pane; ⌘↵ in a new tab; Esc closes. The keys are in the foot.", 'Notion'],
  ["The mic at the field's end (or ⌥V): it records, the time and level only; ↵ stops; Transcribing…, then the results. While it records, a key drops the recording and types.", 'the phone; r797'],
  ['What you say goes where typing would: over the words if all are selected, else after them (lit). A word heard two ways: click the right one.', 'the phone'],
  ['⌘K again: the last words, selected, with what they found (type to start over).', "Notion; the phone's Back"],
  ["The list keeps no search box: its filter is an icon at the end of the views’ row. The home page's box goes too: ⌘K opens this there.", 'r796, r769'],
]

/** Click your way through it (it never plays itself; the yellow spot is the next click or key): type, preview, a kind,
 * open, search again, say it, fix a word, say more, close. Under it, the desktop's choices. */
export const WalkThrough: StoryObj = {
  name: 'Walk through',
  render: () => (
    <div className="flex flex-col gap-6 bg-white p-6 dark:bg-zinc-900">
      <TourFrame layout="desk" tour={TOUR} width={1440} height={900}>
        <SearchDesk />
      </TourFrame>
      <section className="max-w-3xl text-sm text-zinc-700 dark:text-zinc-300">
        <h2 className="mb-2 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">The desktop&apos;s choices</h2>
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
