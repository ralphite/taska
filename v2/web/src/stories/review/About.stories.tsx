// B510 (#6676): what the Review section is for.
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = { title: 'Review/About this section', parameters: { layout: 'padded' } }
export default meta

/** What goes in Review, and when it leaves. */
export const About: StoryObj = {
  render: () => (
    <div className="max-w-xl text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
      <h1 className="mb-3 text-xl font-semibold">Review</h1>
      <p className="mb-3">
        Demos of what Yadong asked about: a question, a problem, something that may change. Each plays the real page on
        the real Taska server, like every demo, and shows all the cases side by side on the phone and the desktop. Its
        folder is named after the item it answers.
      </p>
      <p className="mb-3">
        Yadong opens the link from the item, plays it, and confirms there. Once it is settled, the demo moves into Demo
        and stays there, so the same case is checked again whenever the page changes.
      </p>
      <p className="text-zinc-500 dark:text-zinc-400">
        A case the page cannot show yet is not drawn: its demo says what would have to change.
      </p>
    </div>
  ),
}
