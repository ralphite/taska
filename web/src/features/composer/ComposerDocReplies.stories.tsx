// Replying in a thread, and choices ticked in the document.
import type { Meta } from '@storybook/react-vite'
import { threadKey } from '../../model/docs'
import { PLAN, TICKED } from '../../stories/boxFixtures'
import { at } from '../../stories/composerDocFixtures'

export default { title: 'Components/Input box/Commenting on a document/Replies and choices' } satisfies Meta

export const ReplyingInAThread = at({ at: 'D1', reply: threadKey(PLAN.blocks[0].comments[0]) })
export const ChoicesTicked = at({ at: 'D1', ticks: TICKED })
export const ChoicesTickedAndAPick = at({ at: 'D1', ticks: TICKED, sel: ['k1'] })
