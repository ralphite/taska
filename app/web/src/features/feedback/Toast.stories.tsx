import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { Toast, type ToastView } from './Toast'

const meta: Meta = { title: 'Components/Toast' }
export default meta
type Story = StoryObj

const toast = (t: ToastView) => (
  <div className="relative h-20 transform-gpu">
    <Toast toast={t} place="left-1/2 top-4 -translate-x-1/2" onAction={() => {}} onClose={() => {}} />
  </div>
)

/** What just happened: plain, with Undo, an error, one that stays until closed. */
export const Toasts: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {() => (
        <States
          items={[
            ['plain', toast({ text: 'T9 put back', error: false, sticky: false, action: null })],
            ['with Undo', toast({ text: 'T9 approved', error: false, sticky: false, action: { label: 'Undo' } })],
            ['an error', toast({ text: 'Not saved: T9 marked done: T09 is proposed', error: true, sticky: false, action: null })],
            ['stays until closed', toast({ text: 'Taska has an update', error: false, sticky: true, action: { label: 'Reload' } })],
            ['long words (two lines at most)', toast({ text: 'F012 is done, with your note · 3 subitems still open. Their talk stays with them.', error: false, sticky: false, action: { label: 'Undo' } })],
          ]}
        />
      )}
    </Frames>
  ),
}
