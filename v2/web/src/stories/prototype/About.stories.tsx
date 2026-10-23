// T457 (#5757): what the Prototype section is for.
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = { title: 'Prototype/About this section', parameters: { layout: 'padded' } }
export default meta

/** What goes in Prototype, and when it leaves. */
export const About: StoryObj = {
  render: () => (
    <div className="max-w-xl text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
      <h1 className="mb-3 text-xl font-semibold">Prototype</h1>
      <p className="mb-3">
        Designs that are not built yet: Yadong wants to see them before deciding. Each starts from the page as it is and
        changes only the part asked about.
      </p>
      <p className="mb-3">
        Components, Pages and Demo show what is built. Once a prototype is decided and built, it is deleted here, or
        moved to Demo (or into a component&apos;s stories) and brought up to date with the page.
      </p>
      <p className="text-zinc-500 dark:text-zinc-400">
        Words about a prototype go beside or above it, never over the page.
      </p>
    </div>
  ),
}
