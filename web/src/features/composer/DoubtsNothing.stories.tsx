// A voice note whose words are still coming, with no words heard, with no transcript, or not uploaded (B725).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { voice } from '../../stories/doubtsFixtures'

export default { title: 'UI/Input box/Voice/Cut short or nothing heard' } satisfies Meta

export const MayBeCutShort: StoryObj = { ...voice({ transcript: 'fast' }, 'Keep the sort'), name: 'More words coming' }
export const NoWordsHeard: StoryObj = { ...voice({ transcript: 'none' }), name: 'No words heard' }
export const NoTranscript: StoryObj = { ...voice({ transcript: 'failed' }), name: 'Writing it out failed' }
export const UploadFailed: StoryObj = { ...voice({ f: '', failed: true }), name: 'Upload failed' }
