// What just happened (T591: Floating > Toast): the page's own Toast over the item list, as the page places it: above
// the box over the pane you acted in on the desktop, above the box on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, Hold } from '../../stories/Frames'
import { act } from '../../stories/acts'
import { listOf, PROJECT } from '../../stories/listFixtures'
import { CANT_RECORD, MUTED_BY_PHONE, TOO_SHORT, cancelledKept, micTrouble, noSound } from '../../model/micWords'
import { Toast, type ToastView } from './Toast'

export default { title: 'Components/Around the page/Floating/Toast' } satisfies Meta
type Story = StoryObj

const toastAction = act('Toast: its button')

/** `t`: the toast, or the desktop's and the phone's */
const one = (t: ToastView | ((desk: boolean) => ToastView)): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={420}>
      {(layout) => (
        <div className="relative h-full">
          {listOf(PROJECT, 'items', {}, layout === 'desk')}
          {/* × closes it; its button (Undo, Open, Reload, Retry) needs Taska or the page: the Actions panel, and it goes */}
          <Hold<boolean> start>
            {(shown, set) =>
              shown ? (
                <Toast toast={typeof t === 'function' ? t(layout === 'desk') : t} place={layout === 'desk' ? '-translate-x-1/2' : 'inset-x-0 mx-auto'} style={layout === 'desk' ? { left: '50%', bottom: '20px' } : { bottom: '24px' }} onAction={() => (toastAction(), set(false))} onClose={() => set(false)} />
              ) : null
            }
          </Hold>
        </div>
      )}
    </Frames>
  ),
})

export const Plain: Story = { ...one({ text: 'Copied', error: false, sticky: false, action: null }), name: 'Plain (Copied)' }
export const WithUndo: Story = { ...one({ text: 'T009 approved', error: false, sticky: false, action: { label: 'Undo' } }), name: 'With Undo' }
export const Error: Story = { ...one({ text: 'Not saved: F012 marked done: Taska said it is archived', error: true, sticky: false, action: null }), name: 'Error: Taska said no' }
export const Moved: Story = { ...one({ text: 'Moved F012 to Home', error: false, sticky: false, action: { label: 'Open' } }), name: 'Moved, with Open' }
/** It stays until closed. */
export const Sticky: Story = { ...one({ text: 'Taska has an update', error: false, sticky: true, action: { label: 'Reload' } }), name: 'Stays until closed' }
/** Long words: two lines at most. */
export const Long: Story = { ...one({ text: 'F012 is done, with your note · 3 subitems still open. Their talk stays with them.', error: false, sticky: false, action: { label: 'Undo' } }), name: 'Long words' }
// ---- more states (T639)
export const ErrorStays: Story = { ...one({ text: '#12: your change did not go through. Your words are back in the box; send again', error: true, sticky: true, action: null }), name: 'Error that stays until closed' }
export const ErrorWithRetry: Story = { ...one({ text: 'Order not saved', error: true, sticky: false, action: { label: 'Retry' } }), name: 'Error with Retry' }
// ---- the microphone's (R4-3): the desktop's way to allow it and the phone's
const mic = (text: (desk: boolean) => string, error = false): Story => one((desk) => ({ text: text(desk), error, sticky: false, action: null }))
export const MicNotAllowed: Story = { ...mic((desk) => micTrouble('NotAllowedError', desk, true), true), name: 'Microphone not allowed' }
export const MicBusy: Story = { ...mic((desk) => micTrouble('NotReadableError', desk, true), true), name: 'Microphone busy' }
export const MicNoHttps: Story = { ...mic((desk) => micTrouble('', desk, false), true), name: 'Microphone needs HTTPS' }
export const NoMicrophone: Story = { ...mic((desk) => micTrouble('NotFoundError', desk, true), true), name: 'No microphone found' }
export const MutedByPhone: Story = { ...mic(() => MUTED_BY_PHONE, true), name: 'Phone muted the microphone' }
export const TooShort: Story = { ...mic(() => TOO_SHORT), name: 'Too short, discarded' }
export const NoSound: Story = { ...mic(noSound, true), name: 'No sound from the microphone' }
export const CantRecord: Story = { ...mic(() => CANT_RECORD, true), name: "This browser can't record" }
export const RecordingCancelled: Story = { ...mic(cancelledKept), name: 'Recording cancelled, kept' }
