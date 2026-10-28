// What the Prototype section is for (T457, #5757).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionAbout } from './Section'

export default { title: 'Prototype/About this section', parameters: { layout: 'padded' } } satisfies Meta

/** What goes in Prototype, and when it leaves. */
export const About: StoryObj = {
  render: () => (
    <SectionAbout name="Prototype" note="Words about a prototype go beside or above it, never over the page.">
      <p>
        Designs that are not built yet: Yadong wants to see them before deciding. Each starts from the page as it is and changes only the part asked
        about.
      </p>
      <p>
        Components, Pages and Demo show what is built. Once a prototype is decided and built, it is deleted here, or moved to Demo (or into a
        component&apos;s stories) and brought up to date with the page.
      </p>
    </SectionAbout>
  ),
}
