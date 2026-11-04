// The control on a place picked to comment on (B498), alone: Voice and Comment; speaking, the recording strip (✕, the
// time and level, ✓, ↑). The desktop's beside the place, the phone's a row under it. Where each sits on a page:
// Document › Commenting › Voice and words on a place.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { clock } from '../model/time'
import { Hold } from '../stories/Frames'
import { acts } from '../stories/acts'
import { PLACE_LEVELS, PlaceVoice, PlaceVoiceRow, RecBar } from './PlaceVoice'

export default { title: 'Components/Document/Commenting/The control on a place' } satisfies Meta
type Story = StoryObj

const acted = acts('Place', ['comment', 'check', 'send'] as const)
/** Voice starts its recording strip; its x stops it, its check and arrow hand it on (the Actions panel) */
const live = (rec: boolean, draw: (rec: boolean, on: { say(): void; comment(): void; cancel(): void; check(): void; send(): void }) => ReactNode) => (
  <Hold start={rec}>{(r, set) => draw(r, { say: () => set(true), comment: acted.comment, cancel: () => set(false), check: () => (set(false), acted.check()), send: () => (set(false), acted.send()) })}</Hold>
)
const LEVELS = [0.3, 0.75, 0.5, 0.95, 0.4, 0.65, 0.2, 0.85, 0.55, 0.35, 0.9, 0.6]
const meter = (n: number) => <RecBar time={clock(2000)} levels={LEVELS.slice(-n)} />

export const Desktop: Story = {
  name: 'Desktop: the two buttons, and speaking',
  render: () => (
    <div className="flex flex-col items-start gap-4 bg-zinc-50 p-6 dark:bg-zinc-900">
      {live(false, (rec, on) => <PlaceVoice rec={rec} meter={meter(PLACE_LEVELS.desk)} on={on} />)}
      {live(true, (rec, on) => <PlaceVoice rec={rec} meter={meter(PLACE_LEVELS.desk)} on={on} />)}
    </div>
  ),
}

export const Phone: Story = {
  name: 'Phone: the row, and speaking',
  render: () => (
    <div className="flex w-[393px] flex-col gap-4 bg-zinc-50 p-4 dark:bg-zinc-900">
      {live(false, (rec, on) => <PlaceVoiceRow rec={rec} meter={meter(PLACE_LEVELS.phone)} on={on} />)}
      {live(true, (rec, on) => <PlaceVoiceRow rec={rec} meter={meter(PLACE_LEVELS.phone)} on={on} />)}
    </div>
  ),
}
