// The phone's Inputs tab, one story for each state: the
// page's own rows (inputRows, outgoingRows) and InputsView with a demo project's inputs. The desktop has no Inputs tab:
// what you said is under New input there.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames } from '../../stories/Frames'
import { showSwiped } from '../../ui/rowSwipe'
import { out } from '../../stories/boxFixtures'
import { inputsOf, type Said } from '../../stories/inputFixtures'

export default { title: 'UI/Inputs page/Inputs tab' } satisfies Meta
type Story = StoryObj

const one = (s: Said): Story => ({ render: () => <Frames desk={false} phoneWidth={393} height={852}>{() => inputsOf(s)}</Frames> })

/** Everything you said, by day, with where each stands and what became of it. */
export const InputsTab: Story = { ...one({}), name: 'All inputs' }
/** Just sent, Taska not answering yet: on its way, first. */
export const InputsTabWithOneOnItsWay: Story = { ...one({ outbox: [out({ text: 'Also the sort, please.' })] }), name: 'One on its way' }
export const InputsTabEmpty: Story = { ...one({ inputs: [] }), name: 'Empty' }
// ---- more states (T639)
/** the first input of a project still on its way: only its row, no "No inputs yet." */
export const EmptyOneOnItsWay: Story = { name: 'Empty, one on its way', render: () => <Frames desk={false} phoneWidth={393} height={360}>{() => inputsOf({ inputs: [], outbox: [out({ q: 'a', text: 'Make the export button bigger' })] })}</Frames> }
/** a voice note being recorded into a new input: its row comes first, with how long so far (B627) */
export const InputsTabRecording: Story = { ...one({ recording: '0:12' }), name: 'A voice note being recorded' }
// ---- the swipe (D115 #42), drawn by the swipe's own code, mid-swipe: right on the first row that became an item (only
// such a row opens one), left on the first row
/** `dx` right: opening the item it became, mid-swipe; left: Move and Delete left open, as wide as their buttons */
const swiped = (dx: number): Story => ({
  render: () => (
    <Frames desk={false} phoneWidth={393} height={852}>
      {() => (
        <After
          run={(root) => {
            const rows = [...root.querySelectorAll<HTMLElement>('[data-swipe]')]
            const el = dx >= 0 ? rows.find((x) => x.parentElement?.querySelector('[data-swipe-left]')?.textContent?.trim()) : rows[0]
            if (!el) return
            if (dx >= 0) return showSwiped(el, dx)
            showSwiped(el, -1)
            showSwiped(el, -(el.parentElement?.querySelector<HTMLElement>('[data-swipe-right]')?.offsetWidth || -dx))
          }}
        >
          {inputsOf({})}
        </After>
      )}
    </Frames>
  ),
})
/** swiped left: Move and Delete under it (Delete: Undo puts it back) */
export const SwipedLeft: Story = { ...swiped(-1), name: 'Swiped left: Move, Delete' }
/** swiped right: the item it became opens */
export const SwipedRight: Story = { ...swiped(140), name: 'Swiped right: open its item' }
