import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import { BoxHomeSlot, Composer } from './Composer'
import { item, load } from '../test/fixture'
import { U, bump, els } from '../lib/state'

// T457: the one input box, in the states it is seen in most
const setup =
  (f: { open?: number | null; text?: string; amend?: boolean; files?: number } = {}) =>
  () => {
    load([item(1, { title: 'Export ignores the filter', type: 'bug' })], {
      inputs: [
        {
          id: 'r12',
          t: new Date().toISOString(),
          by: 'you',
          text: 'The export ignores my filter',
          scope: 1,
          files: [],
          acked: false,
          touched: [],
          org: null,
          seq: 1,
        },
      ],
    })
    U.open = f.open === undefined ? 1 : f.open
    U.amend = f.amend ? { id: 'r12', mode: 'edit', v: 1, base: 'The export ignores my filter' } : null
    U.files = Array.from({ length: f.files || 0 }, (_, i) => ({
      f: `f${i}-shot.png`,
      name: `shot-${i + 1}.png`,
      mime: 'image/png',
      size: 120000,
    })) as typeof U.files
    return { text: f.text || '' }
  }
function Box({ text }: { text: string }) {
  useEffect(() => {
    if (els.text) els.text.value = text
    bump('composer')
  }, [text])
  return (
    <div className="flex min-h-[320px] max-w-[46rem] flex-col justify-end p-3">
      <BoxHomeSlot />
      <Composer />
    </div>
  )
}
const meta: Meta = { title: 'Page/Input box' }
export default meta
const render = (_: unknown, { loaded }: { loaded: Record<string, unknown> }) => <Box text={loaded.text as string} />
/** Empty, replying to an item. */
export const Empty: StoryObj = { loaders: [setup()], render }
/** A new input from the project, nothing open. */
export const NewInput: StoryObj = { loaders: [setup({ open: null })], render }
/** Several lines of words. */
export const LongText: StoryObj = {
  loaders: [
    setup({
      text: 'The export ignores my filter.\nWhen I set the filter to P0 and export, every row comes out, not just the P0 ones.\nIt happens on the phone and on the desktop, and after a reload too.\nCan you look at it today?',
    }),
  ],
  render,
}
/** With two images attached. */
export const WithFiles: StoryObj = { loaders: [setup({ text: 'See the screenshots', files: 2 })], render }
/** Editing an input you sent. */
export const EditingInput: StoryObj = {
  loaders: [setup({ amend: true, text: 'The export ignores my filter' })],
  render,
}
