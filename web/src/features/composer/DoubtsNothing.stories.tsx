// A voice note whose words are still coming, with no words heard, or with no transcript.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { voice } from '../../stories/doubtsFixtures'

export default { title: 'UI/Input box/Voice/Cut short or nothing heard' } satisfies Meta

export const MayBeCutShort: StoryObj = { ...voice({ tr: 'Keep the sort', more: true }, 'Keep the sort'), name: 'More words coming' }
export const NoWordsHeard: StoryObj = { ...voice({ tr: '' }), name: 'No words heard' }
export const NoTranscript: StoryObj = { ...voice({ tr: '', trError: 'Gemini HTTP 503' }), name: 'Writing it out failed' }
