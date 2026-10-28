// What the Review section is for (B510, #6676).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionAbout } from './Section'

export default { title: 'Review/About this section', parameters: { layout: 'padded' } } satisfies Meta

/** What goes in Review, and when it leaves. */
export const About: StoryObj = {
  render: () => (
    <SectionAbout name="Review" note="Proposed controls are identified separately from the product components they accompany.">
      <p>
        Cases Yadong asked about: a question, a problem, something that may change. Each draws the relevant product components with story data,
        on the phone and the desktop. Interactive cases keep their state in the story and need no Taska server.
      </p>
      <p>
        Yadong opens the link from the item, compares the states or tries the available controls, and confirms there. Once settled and built,
        keep the case in the component&apos;s stories or a demo so it can be checked when the page changes.
      </p>
    </SectionAbout>
  ),
}
