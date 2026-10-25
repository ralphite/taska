// B498 (r815, #7079): Review, before anything is built. One way to comment on any place picked in a page (a Markdown
// paragraph, a part of a web page), on the desktop and the phone: its states one under another (light or dark is the
// toolbar's). Each is clickable from where it starts (nothing plays by itself): the two buttons, the recording strip
// (✕ · ✓ · ↑), what ✓ and ↑ and ✕ leave. The new control is drawn in placeComment.tsx; the box, the comment and the
// toast are the page's own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Scene, type Kind, type Step } from './placeComment'

export default { title: 'Review/B498 Comment on a place: voice and words', parameters: { layout: 'padded' } } satisfies Meta
type Story = StoryObj

const STATES: { step: Step; title: string; note(phone: boolean): string }[] = [
  {
    step: 'picked',
    title: '1 · Picked: voice and comment',
    note: (phone) => (phone ? 'A tap picks the place (amber). Under it: speak (the round black button) or comment. Tap one.' : 'A place picked (amber) has two buttons beside it: speak and comment. Tap one.'),
  },
  {
    step: 'recording',
    title: '2 · Speaking: the buttons become a small recording strip, where they are',
    note: () => 'Speak became ✓ (stop; the words go into the box below, at this place), comment became ↑ (send at once), ✕ at the far left cancels. The time runs and the level moves, as in the input box; the box below stays as it was. Tap ✓, ↑ or ✕.',
  },
  {
    step: 'checked',
    title: '3 · After ✓: the words are in the input box below, at this place',
    note: () => "The box says what it comments on, the voice note and its words are in it: add to them, then send with the box's Comment. The place stays picked.",
  },
  {
    step: 'sent',
    title: '4 · After ↑: sent, and on the place at once',
    note: () => 'Its count is on the place and the comment opens there at once; “…” and Sending… until its words are worked out, then the words (here after a moment).',
  },
  {
    step: 'cancelled',
    title: '5 · After ✕: nothing sent',
    note: () => 'Back to the two buttons; the recording can come back for a few seconds with Undo (as Esc says now).',
  },
  {
    step: 'typing',
    title: '6 · Comment (words): the input box below, at this place',
    note: (phone) => (phone ? 'The box opens at the bottom with the keyboard, saying what it comments on.' : 'The caret goes into the box below, which says what it comments on.'),
  },
]

const states = (kind: Kind, phone: boolean): Story => ({
  render: () => (
    <div className="flex flex-col gap-10 pb-10">
      {STATES.map((s) => (
        <section key={s.step}>
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</h2>
          <p className="mb-3 max-w-3xl text-[13px] text-zinc-600 dark:text-zinc-400">{s.note(phone)}</p>
          <Scene kind={kind} phone={phone} start={s.step} />
        </section>
      ))}
    </div>
  ),
})

/** A paragraph of a Markdown document, on the desktop: its buttons beside it, as they are now. */
export const DesktopParagraph: Story = { ...states('md', false), name: 'Desktop · Markdown paragraph' }
/** A part of a web page, on the desktop: its buttons just above its right end, as they are now. */
export const DesktopWebPart: Story = { ...states('web', false), name: 'Desktop · web page part' }
/** A paragraph on the phone (393): the row under it, made for a thumb. */
export const PhoneParagraph: Story = { ...states('md', true), name: 'Phone 393 · Markdown paragraph' }
/** A part of a web page on the phone (393): the row under it, over the page. */
export const PhoneWebPart: Story = { ...states('web', true), name: 'Phone 393 · web page part' }
