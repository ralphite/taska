// A voice note's words as said, and what you said's earlier versions (T591: Menus and sheets > Sheets): the page's
// own sheets: Original words on the phone (the desktop shows them under the pointer), the history on both. Its menu is in
// stories/InputMenu.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { input, steps, T } from '../../stories/fixtures'
import { opened } from '../../stories/menuFixtures'
import { talkEnv } from '../../stories/itemFixtures'
import { modelOf } from '../../stories/fixtures'
import type { VoiceStep } from '../../model/types'
import { asSaidSheet, historySheet } from './InputSheets'

export default { title: 'UI/Inputs page/Its words and history' } satisfies Meta
type Story = StoryObj

const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const r = input({
  id: 'r12',
  text: 'The export should keep the filter and the sort I set.',
  history: [
    { text: 'The export should keep it.', t: at(60), mode: 'edit' },
    { text: 'The export should keep the filter I set.', t: at(40), mode: 'append' },
  ],
})

/** Before its words were tidied: as the models heard them, then every step that worked them out (T697: its model,
 * its time, its words; a check on those chosen). Only the phone has this sheet (the desktop shows the same under the
 * pointer, B640: Floating › Tip › On a voice note). */
const sheetAt = (heard: string, tr: string, height = 360, s: VoiceStep[] = []) => () => <Frames height={height} desk={false} phoneWidth={393}>{() => opened(asSaidSheet(heard, tr, s), false)}</Frames>
const HEARD = 'Keep the filter, um, in the export, and, uh, the sort. The sort too.'
const TIDIED = 'Keep the filter and the sort in the export.'
const ASR = 'keep the filter um in the export and uh the salt the salt too'
export const AsSaid: Story = { name: 'Original words: word for word, tidied and each step', render: sheetAt(HEARD, TIDIED, 760, steps(HEARD, TIDIED, ASR)) }
/** the strong model ran out of time: its error is kept, and the speech model's words were chosen */
export const AsSaidStepFailed: Story = { name: 'Original words: a step that failed', render: sheetAt(ASR, TIDIED, 760, steps(HEARD, TIDIED, ASR, true)) }
export const AsSaidNothingTidied: Story = { name: 'Original words: nothing tidied', render: sheetAt('', 'Keep the filter in the export.') }
/** Each version, the latest first, with when and how it changed. */
export const InputHistory: Story = { name: 'What you said: history', render: () => <Frames height={520} deskWidth={900} phoneWidth={393}>{(layout) => opened(historySheet(r, Date.parse(T), talkEnv(modelOf([], [r]), false).world), layout === 'desk')}</Frames> }
// ---- more states (T639)
export const AsSaidNoWords: Story = { name: 'Original words: no words heard', render: sheetAt('', '') }
