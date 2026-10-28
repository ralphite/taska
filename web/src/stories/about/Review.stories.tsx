// What the Review section is for (B510, #6676).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionAbout } from './Section'

export default { title: 'Review/About this section', parameters: { layout: 'padded' } } satisfies Meta

/** What goes in Review, and when it leaves. */
export const About: StoryObj = {
  render: () => (
    <SectionAbout name="Review" note="A case the page cannot show yet is not drawn: its demo says what would have to change.">
      <p>
        Demos of what Yadong asked about: a question, a problem, something that may change. Each plays the real page on the real Taska server, like every
        demo, and shows all the cases side by side on the phone and the desktop. Its folder is named after the item it answers.
      </p>
      <p>
        Yadong opens the link from the item, plays it, and confirms there. Once it is settled, the demo moves into Demo and stays there, so the same case
        is checked again whenever the page changes.
      </p>
    </SectionAbout>
  ),
}
