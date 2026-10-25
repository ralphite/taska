// What Storybook is for and the rules every story keeps, in a few plain lines (T592; T518, R489, R519, R531, R544,
// R549, R559, R577, R598).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionAbout } from './Section'

export default { title: 'Components/About this section', parameters: { layout: 'padded' } } satisfies Meta

/** The rules, short. */
export const About: StoryObj = {
  render: () => (
    <SectionAbout name="Storybook" note="A story that breaks a rule is a bug, like a bug in the page.">
      <p>
        <b>Real.</b> A story is a component the page really uses, given data. No logic or drawing of its own. At the same size with the same
        data it looks exactly like the page.
      </p>
      <p>
        <b>Complete.</b> Every state the page can show has its story. The states of one part sit together, so they can be compared.
      </p>
      <p>
        <b>Easy to find.</b> Grouped by what you see (item list, item page, conversation, input box, document, menus and sheets, top bar, sidebar,
        settings), one story per state, named for what it shows.
      </p>
      <p>
        <b>Sections.</b> Components: still pictures of each part. Pages: whole pages. Demo: a recording of using it. Prototype: designs not built
        yet. Review: a question for Yadong, drawing only the part it is about.
      </p>
      <p>
        <b>Phone and desktop side by side</b> when the part has both. Light or dark: the Theme switch in the toolbar.
      </p>
      <p>
        <b>Kept up to date.</b> A change to the page changes its stories in the same commit; a part that is removed takes its stories with it.
        Storybook needs no Taska server.
      </p>
    </SectionAbout>
  ),
}
