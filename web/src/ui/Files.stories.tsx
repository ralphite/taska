import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { PICTURE } from '../stories/fixtures'
import type { FileRef } from '../model/types'
import { Thumbs, VoiceChip, type PlayState } from './Files'

const meta: Meta = { title: 'Components/Conversation/Message parts/Voice notes, pictures, files' }
export default meta
type Story = StoryObj

const voice: FileRef = { f: 'f3-voice_1-05.webm', name: 'voice_1-05.webm', mime: 'audio/webm' }
const unnamed: FileRef = { f: 'f4-note.webm', name: 'note.webm', mime: 'audio/webm' }
const picture: FileRef = { f: 'f5-shot.png', name: 'shot.png', mime: 'image/png' }
const pdf: FileRef = { f: 'f6-report.pdf', name: 'Quarterly report with a long name.pdf', mime: 'application/pdf' }
const chip = (f: FileRef, play: PlayState, tidy = true) => (
  <div className="flex p-3">
    <VoiceChip f={f} src="#" play={play} tidy={tidy} onPlay={() => {}} onWords={() => {}} />
  </div>
)

/** A voice note, its words tidied as Taska normally has it (the phone: its original words): its length; playing, how
 * far; paused partway; and with tidying off in Settings (no original words). */
export const Voice: Story = {
  name: 'Voice notes',
  render: () => (
    <Frames phoneWidth={393} deskWidth={480}>
      {() => (
        <States
          items={[
            ['not played', chip(voice, { playing: false, t: null })],
            ['playing', chip(voice, { playing: true, t: 23000 })],
            ['paused partway', chip(voice, { playing: false, t: 41000 })],
            ['no length in its name', chip(unnamed, { playing: false, t: null })],
            ['tidying voice notes off (Settings): no original words', chip(voice, { playing: false, t: null }, false)],
          ]}
        />
      )}
    </Frames>
  ),
}

/** What came with something said: a voice note, a picture, another file; small and large. */
export const Together: Story = {
  name: 'Pictures and files together',
  render: () => (
    <Frames phoneWidth={393} deskWidth={480}>
      {() => (
        <States
          items={[
            ['all three', <div className="flex flex-wrap items-end gap-2 p-3"><Thumbs files={[voice, picture, pdf]} url={(f) => (f === picture.f ? PICTURE : '#')} play={() => ({ playing: false, t: null })} tidy on={{ play() {}, words() {}, view() {} }} /></div>],
            ['small pictures', <div className="flex flex-wrap items-end gap-2 p-3"><Thumbs files={[picture, { ...picture, f: 'f7-shot.png' }]} url={() => PICTURE} size="size-12" play={() => ({ playing: false, t: null })} tidy on={{ play() {}, words() {}, view() {} }} /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}
// ---- more states (T639)
const many: FileRef[] = [picture, { ...picture, f: 'f8-a.png' }, { ...picture, f: 'f9-b.png' }, pdf, { ...picture, f: 'f10-c.png' }]
/** more than three: the row fades at its right edge and slides sideways */
export const MoreThanThree: Story = {
  name: 'More than three pictures and files',
  render: () => (
    <Frames phoneWidth={393} deskWidth={480}>
      {() => <div className="flex p-3"><Thumbs files={many} url={(f) => (f.endsWith('.pdf') ? '#' : PICTURE)} play={() => ({ playing: false, t: null })} tidy on={{ play() {}, words() {}, view() {} }} /></div>}
    </Frames>
  ),
}
