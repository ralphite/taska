// What just happened (T591: Floating > Toast): the page's own Toast over the item list, as the page places it: above
// the box over the pane you acted in on the desktop, above the box on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { listOf, PROJECT } from '../../stories/listFixtures'
import { Toast, type ToastView } from './Toast'

export default { title: 'Components/Floating/Toast' } satisfies Meta
type Story = StoryObj

const one = (t: ToastView): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={420}>
      {(layout) => (
        <div className="relative h-full">
          {listOf(PROJECT, 'items', {}, layout === 'desk')}
          <Toast toast={t} place={layout === 'desk' ? '-translate-x-1/2' : 'inset-x-0 mx-auto'} style={layout === 'desk' ? { left: '50%', bottom: '20px' } : { bottom: '24px' }} onAction={() => {}} onClose={() => {}} />
        </div>
      )}
    </Frames>
  ),
})

export const Plain: Story = { ...one({ text: 'Copied for your agent', error: false, sticky: false, action: null }), name: 'Plain (Copied)' }
export const WithUndo: Story = { ...one({ text: 'T009 approved', error: false, sticky: false, action: { label: 'Undo' } }), name: 'With Undo' }
export const Error: Story = { ...one({ text: 'Not saved: F012 marked done: Taska said it is archived', error: true, sticky: false, action: null }), name: 'Error: Taska said no' }
export const Moved: Story = { ...one({ text: 'F012 moved to Home', error: false, sticky: false, action: { label: 'Open' } }), name: 'Moved, with Open' }
/** It stays until closed. */
export const Sticky: Story = { ...one({ text: 'Taska has an update', error: false, sticky: true, action: { label: 'Restart' } }), name: 'Stays until closed' }
/** Long words: two lines at most. */
export const Long: Story = { ...one({ text: 'F012 is done, with your note · 3 subitems still open. Their talk stays with them.', error: false, sticky: false, action: { label: 'Undo' } }), name: 'Long words' }
