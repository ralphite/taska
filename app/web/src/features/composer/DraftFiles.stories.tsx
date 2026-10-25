import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { PICTURE } from '../../stories/fixtures'
import { DraftFiles, type DraftFile } from './DraftFiles'

const meta: Meta = { title: 'Components/Input box/Pictures and files' }
export default meta
type Story = StoryObj

const files = (list: DraftFile[]): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={640}>{() => <DraftFiles files={list} url={() => PICTURE} onRemove={() => {}} onView={() => {}} />}</Frames> })
const pic = (n: number, up = true): DraftFile => ({ key: 'p' + n, f: up ? `f${n}-shot.png` : '', name: 'shot.png', mime: 'image/png', preview: PICTURE })

export const TwoPictures = files([pic(1), pic(2)])
export const APictureGoingUp = files([pic(1, false)])
export const AFile = files([{ key: 'c', f: 'f3-report.pdf', name: 'Quarterly report.pdf', mime: 'application/pdf' }])
export const MoreThanFitTheyScrollSideways: Story = { ...files(Array.from({ length: 9 }, (_, i) => pic(i + 1))), name: 'More than fit: they scroll sideways' }
