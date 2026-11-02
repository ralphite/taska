// A message with pictures, a voice note or a file.
import type { Meta } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { at, pdf, voiceNote } from '../../stories/talkFromAgentFixtures'

export default { title: 'Components/Conversation/Message/From an agent/Pictures, voice, files' } satisfies Meta

export const WithPictures = at([message({ id: 2, text: 'Before and after:', files: [{ f: 'f1-before.png', name: 'before.png', mime: 'image/png' }, { f: 'f2-after.png', name: 'after.png', mime: 'image/png' }] })])
export const WithAVoiceNote = at([message({ id: 2, text: 'Here is what I found.', files: [voiceNote] })])
export const WithAFile = at([message({ id: 2, text: 'The report is attached.', files: [pdf] })])
