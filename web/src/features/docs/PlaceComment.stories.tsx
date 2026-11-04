// Commenting on a place picked in a page (B498, approved r1047): a Markdown paragraph, words selected or a part of a
// web page, on the desktop and the phone. Picked, it has two buttons beside it (on the phone a row under it): Voice
// and Comment. Voice turns them, where they are, into a small recording strip: ✕ at the far left cancels, Voice
// becomes ✓ (stop: on the desktop its words go into the box below, at this place; on the phone, which has no box over
// a document, it is sent), Comment becomes ↑ (sent at once). Comment writes in the box below, at this place. Each
// story: the steps one under another (light or dark is the toolbar's), drawn by the page's own components.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlaceStep, type Kind, type Step } from '../../stories/placeComment'

export default { title: 'Components/Document/Commenting/Voice and words on a place', parameters: { layout: 'padded' } } satisfies Meta
type Story = StoryObj

const STEPS: { step: Step; title: string; note(desk: boolean): string; phone?: boolean }[] = [
  {
    step: 'picked',
    title: '1 · Picked: voice and comment',
    note: (desk) => (desk ? 'A place picked (amber) has two buttons beside it: speak and comment.' : 'A tap picks the place (amber). Under it: speak (the round black button) or comment.'),
  },
  {
    step: 'recording',
    title: '2 · Speaking: the buttons become a small recording strip, where they are',
    note: (desk) =>
      desk
        ? 'Speak became ✓ (stop; the words go into the box below, at this place), comment became ↑ (send at once), ✕ at the far left cancels (Esc too). The box below stays as it was.'
        : 'Speak became ✓ and comment ↑: either sends it (the phone has no box over a document); ✕ at the far left cancels.',
  },
  {
    step: 'checked',
    title: '3 · After ✓: the words are in the box below, at this place',
    note: () => "The box says what it comments on; the voice note and its words are in it: add to them, then send with the box's Comment. The place stays picked.",
    phone: false,
  },
  {
    step: 'sent',
    title: '4 · After ↑ (on the phone ✓ too): sent, and on the place at once',
    note: () => 'Its count is on the place and the comment opens there at once.',
  },
  {
    step: 'cancelled',
    title: '5 · After ✕: nothing sent',
    note: () => 'Back to the two buttons; Undo brings the recording back for a few seconds.',
  },
  {
    step: 'typing',
    title: '6 · Comment (words): the box below, at this place',
    note: (desk) => (desk ? 'The caret goes into the box below, which says what it comments on.' : 'The box opens at the bottom with the keyboard, saying what it comments on.'),
  },
]

const steps = (kind: Kind, desk: boolean): Story => ({
  render: () => (
    <div className="flex flex-col gap-10 pb-10">
      {STEPS.filter((s) => desk || s.phone !== false).map((s) => (
        <section key={s.step}>
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</h2>
          <p className="mb-3 max-w-3xl text-[13px] text-zinc-600 dark:text-zinc-400">{s.note(desk)}</p>
          <PlaceStep kind={kind} desk={desk} step={s.step} />
        </section>
      ))}
    </div>
  ),
})

/** A paragraph of a Markdown document, on the desktop: its buttons beside it. */
export const DesktopParagraph: Story = { ...steps('md', true), name: 'Desktop · Markdown paragraph' }
/** A part of a web page, on the desktop: its buttons just above its right end. */
export const DesktopWebPart: Story = { ...steps('web', true), name: 'Desktop · web page part' }
/** A paragraph on the phone (393): the row under it, made for a thumb. */
export const PhoneParagraph: Story = { ...steps('md', false), name: 'Phone 393 · Markdown paragraph' }
/** A part of a web page on the phone (393): the row under it, over the page. */
export const PhoneWebPart: Story = { ...steps('web', false), name: 'Phone 393 · web page part' }
