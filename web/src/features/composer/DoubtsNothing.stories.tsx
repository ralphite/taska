// A voice note that may be cut short, with no words heard, or with no transcript.
import type { Meta } from '@storybook/react-vite'
import { voice } from '../../stories/doubtsFixtures'

export default { title: 'Components/Input box/Voice/Cut short or nothing heard' } satisfies Meta

export const MayBeCutShort = voice({ tr: 'Keep the sort', more: true }, 'Keep the sort')
export const NoWordsHeard = voice({ tr: '' })
export const NoTranscript = voice({ tr: '', trError: 'Gemini HTTP 503' })
