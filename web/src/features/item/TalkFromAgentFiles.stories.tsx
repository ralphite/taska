// A message with pictures, a voice note or a file.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { at, pdf, voiceNote } from '../../stories/talkFromAgentFixtures'

export default { title: 'UI/Item pane/Talk/Message/From an agent/Pictures, voice, files' } satisfies Meta

export const WithPictures: StoryObj = { ...at([message({ id: 2, text: 'Before and after:', files: [{ f: 'f1-before.png', name: 'before.png', mime: 'image/png' }, { f: 'f2-after.png', name: 'after.png', mime: 'image/png' }] })]), name: 'With pictures' }
export const WithAVoiceNote: StoryObj = { ...at([message({ id: 2, text: 'Here is what I found.', files: [voiceNote] })]), name: 'With a voice note' }
export const WithAFile: StoryObj = { ...at([message({ id: 2, text: 'The report is attached.', files: [pdf] })]), name: 'With a file' }
