// The phone's Inputs tab, one story for each state (T591: the groups and names Yadong had before the rewrite): the
// page's own rows (inputRows, outgoingRows) and InputsView with a demo project's inputs. The desktop has no Inputs tab:
// what you said is under New input there.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { out } from '../../stories/boxFixtures'
import { inputsOf, type Said } from '../../stories/inputFixtures'

export default { title: 'Components/Inputs/Inputs tab' } satisfies Meta
type Story = StoryObj

const one = (s: Said, name: string): Story => ({ name, render: () => <Frames desk={false} phoneWidth={393} height={852}>{() => inputsOf(s)}</Frames> })

/** Everything you said, by day, with where each stands and what became of it. */
export const InputsTab = one({ organizer: true }, 'All inputs')
/** A search: the words lit where they are, and how many the other tabs have. */
export const InputsTabSearch = one({ organizer: true, q: 'coupon' }, 'Search')
/** Just sent, Taska not answering yet: on its way, first. */
export const InputsTabWithOneOnItsWay = one({ organizer: true, outbox: [out({ text: 'Also the sort, please.' })] }, 'One on its way')
export const InputsTabEmpty = one({ inputs: [] }, 'Empty')
