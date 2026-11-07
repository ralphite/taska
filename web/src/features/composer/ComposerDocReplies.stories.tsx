// Replying in a thread, and choices ticked in the document.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { threadKey } from '../../model/docs'
import { PLAN, TICKED } from '../../stories/boxFixtures'
import { at } from '../../stories/composerDocFixtures'

export default { title: 'UI/Input box/Commenting on a document/Replies and choices' } satisfies Meta

export const ReplyingInAThread: StoryObj = { ...at({ at: 'D1', reply: threadKey(PLAN.blocks[0].comments[0]) }), name: 'Replying in a thread' }
export const ChoicesTicked: StoryObj = { ...at({ at: 'D1', ticks: TICKED }), name: 'Choices ticked' }
export const ChoicesTickedAndAPick: StoryObj = { ...at({ at: 'D1', ticks: TICKED, sel: ['k1'] }), name: 'Choices ticked and a paragraph picked' }
