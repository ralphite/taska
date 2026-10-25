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
        <b>Real.</b> A story is a component the page really uses, given data and a state the page can really be in. No logic or drawing of its
        own. At the same size with the same data it looks exactly like the page.
      </p>
      <p>
        <b>Only what the page uses.</b> A component the page does not use goes, with its stories.
      </p>
      <p>
        <b>Complete.</b> Every state the page can show has its story. The states of one part sit together, so they can be compared.
      </p>
      <p>
        <b>Easy to find.</b> Grouped by what you see (item list, item page, conversation, input box, document, menus and sheets, top bar, sidebar,
        settings), one story per state, named for what it shows, the most used first.
      </p>
      <p>
        <b>Sections.</b> Components: still pictures of each part. Pages: whole pages. Demo: a recording of using it, with a clear mark where it taps,
        at a person&apos;s pace. Prototype: designs not built yet. Review: a question for Yadong, drawing only the part it is about.
      </p>
      <p>
        <b>How it shows.</b> Phone and desktop side by side when the part has both: the phone at its size (393 by 852), the desktop at the width
        the story needs, resized from its corner. Light or dark: the Theme switch in the toolbar.
      </p>
      <p>
        <b>On its own.</b> Storybook needs no Taska server: its data is the story&apos;s.
      </p>
      <p>
        <b>Kept up to date.</b> A change to the page changes its stories in the same commit; a part that is removed takes its stories with it. The
        build says which stories are missing or do not open.
      </p>
      <p>
        <b>Asked first.</b> A new way of doing stories is shown to Yadong first (the rules and one sample folder) and spread once Yadong agrees.
      </p>
    </SectionAbout>
  ),
}
