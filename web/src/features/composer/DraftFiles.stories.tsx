import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { useMedia } from '../../stories/liveParts'
import { Frames } from '../../stories/Frames'
import { PICTURE } from '../../stories/fixtures'
import { DraftFiles, type DraftFile } from './DraftFiles'

const meta: Meta = { title: 'UI/Input box/Pictures and files' }
export default meta
type Story = StoryObj

/** the draft's files as the page's box keeps them: x takes one off, a picture opens in the page's viewer */
function LiveFiles({ start }: { start: DraftFile[] }) {
  const [list, setList] = useState(start)
  const media = useMedia(() => PICTURE)
  const pics = list.filter((f) => f.f && (f.mime || '').startsWith('image/')).map((f) => f.f)
  return (
    <>
      <DraftFiles files={list} url={() => PICTURE} onRemove={(k) => setList(list.filter((f) => f.key !== k))} onView={(k) => media.on.view(list.find((f) => f.key === k)?.f || '', pics)} />
      {media.node}
    </>
  )
}
const files = (list: DraftFile[]): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <LiveFiles start={list} />}</Frames> })
const pic = (n: number, up = true): DraftFile => ({ key: 'p' + n, f: up ? `f${n}-shot.png` : '', name: 'shot.png', mime: 'image/png', preview: PICTURE })

export const TwoPictures: Story = { ...files([pic(1), pic(2)]), name: 'Two pictures' }
export const APictureGoingUp: Story = { ...files([pic(1, false)]), name: 'A picture going up' }
export const AFile: Story = { ...files([{ key: 'c', f: 'f3-report.pdf', name: 'Quarterly report.pdf', mime: 'application/pdf' }]), name: 'A file' }
export const MoreThanFitTheyScrollSideways: Story = { ...files(Array.from({ length: 9 }, (_, i) => pic(i + 1))), name: 'More than fit: they scroll sideways' }
// ---- more states (B636)
export const AFileGoingUp: Story = { ...files([{ key: 'c', f: '', name: 'Quarterly report.pdf', mime: 'application/pdf' }]), name: 'A file going up' }
/** Taska refused them (T728 #10): red, not faded as one still going up; a voice note says Upload failed in its words */
export const UploadsFailed: Story = {
  ...files([
    { ...pic(1, false), failed: true },
    { key: 'c', f: '', name: 'Quarterly report.pdf', mime: 'application/pdf', failed: true },
    { key: 'v', f: '', name: 'voice 0-12.webm', mime: 'audio/webm', ms: 12000, failed: true, transcript: 'wait' },
  ]),
  name: 'Uploads failed',
}
