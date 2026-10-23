// B555 (r781, r785, r786): what the Components section is, and the rule every story in it follows.
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = { title: 'Components/About this section', parameters: { layout: 'padded', taska: { about: true } } }
export default meta

/** What a component story is, and why it cannot differ from the page. */
export const About: StoryObj = {
  render: () => (
    <div className="max-w-xl text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
      <h1 className="mb-3 text-xl font-semibold">Components</h1>
      <p className="mb-3">
        Every part of Taska in every state it has. Each story is the real page, the same app as on Yadong&apos;s screen,
        opened at an address (an item, a document, a view, a search) on the demo&apos;s data. Then it does what a person
        does there: a click, a tap, words typed, a key, the pointer on something, a right-click, a drag, the mic. When
        that changes something, the real Taska server runs in the page and answers, and an agent or the organizer can
        write to it too. The story shows only the part it is about.
      </p>
      <p className="mb-3">
        So a story is never drawn on its own and never sets the page&apos;s state: it shows only what the page itself
        reaches, at the size of a real screen. The build fails on a story that tries (.storybook/check.mjs).
      </p>
      <p className="mb-3">
        Only devices are stood in for: the microphone, the speaker, the speech model, the organizer&apos;s model, and
        how Taska answers (slow, out of reach, saying no). A gallery of one small part&apos;s looks (icons, status
        marks, keys, tiles, agents&apos; marks) is the real component given only its props.
      </p>
      <p className="text-zinc-500 dark:text-zinc-400">
        A state the demo&apos;s data and real steps cannot reach has no story: it is not in the product either.
      </p>
    </div>
  ),
}
