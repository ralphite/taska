// The page's tooltip on a code (a card about what it names: an item, something you said, a document) and on a voice
// note (its original words).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { doc } from './docFixtures'
import { input, item, message, modelOf } from './fixtures'
import { talkOf } from './itemPage'
import { PROJECT } from './listFixtures'
import { one } from './tipFixtures'
import { record, shown, steps } from './fixtures'

export default { title: 'Components/Around the page/Floating/Tip/On codes and voice notes' } satisfies Meta
type Story = StoryObj

/** A code in some words: a card about what it names. */
export const OnCode: Story = {
  ...one(() => talkOf(item({ n: 1, thread: [message({ id: 1, text: 'The sort is in F005, the file name in F003.' })] }), true, { others: PROJECT.filter((it) => it.n !== 1) }), '[data-ref="F005"]', { height: 420 }),
  name: "On an item's code: what it names",
}
const mi = modelOf(PROJECT, [input({ id: 'r12', text: 'The export should keep the filter I set, and the sort.' })], {}, [doc({ d: 4, n: 1, title: 'The export plan' })])
/** a code for something you said, and for a document: the card says who and when and its words, or the document's title */
export const OnInputCode: Story = {
  ...one(() => talkOf(item({ n: 1, thread: [message({ id: 1, text: 'From #12, the plan is in D4.' })] }), true, { others: PROJECT.filter((it) => it.n !== 1), inputs: mi.inputs, docs: mi.docs }), '[data-ref="#12"]', { height: 420, model: mi }),
  name: 'On a code for something you said',
}
const TIDIED = 'Move Settings out into its own dialog; the instructions show as Markdown, in Chinese.'
const SAID = 'So this, we move this Settings dialog, it should be, Settings should be its own dialog, the one that opens from the agent status at the top right, and put it there. And the instructions should be the Markdown drawn, not raw, and in Chinese.'
const ASR = 'so this we move this settings dialogue it should be settings should be its own dialogue the one that opens from the agent status at the top right and put it there and the instructions should be the mark down drawn not raw and in Chinese'
/** a voice note whose words were tidied: its original words, word for word and tidied, without a click (B640), then
 * each step that worked them out, as the phone's sheet shows them (T697) */
export const OnVoiceNote: Story = {
  ...one(
    () =>
      talkOf(item({ n: 12, thread: [message({ id: 1, by: 'you', kind: 'say', text: 'Move Settings out into its own dialog; the instructions show as Markdown, in Chinese.', src: 'r4' })] }), true, {
        others: PROJECT.filter((it) => it.n !== 12),
        inputs: [shown(input({ id: 'r4', text: '', files: [{ f: 'f2-voice_0-26.webm', name: 'voice_0-26.webm', mime: 'audio/webm' }] }), record('f2-voice_0-26.webm', TIDIED, SAID))],
      }),
    '[data-heard]',
    { height: 720, steps: steps(SAID, TIDIED, ASR) },
  ),
  name: 'On a voice note: its original words',
}
export const OnDocCode: Story = {
  ...one(() => talkOf(item({ n: 1, thread: [message({ id: 1, text: 'From #12, the plan is in D4.' })] }), true, { others: PROJECT.filter((it) => it.n !== 1), inputs: mi.inputs, docs: mi.docs }), '[data-ref="D4"]', { height: 420, model: mi }),
  name: "On a document's code",
}
