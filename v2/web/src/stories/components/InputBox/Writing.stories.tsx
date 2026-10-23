// T512, B515: Input box > Writing: what you write, where a new input is written (the New input page on the desktop,
// under the list on the phone). The parts module draws them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/Writing' }
export default meta

export const Empty: StoryObj = { ...InputBox.Empty, name: 'Empty' }
export const Words: StoryObj = { ...InputBox.Words, name: 'A few words' }
export const ManyLines: StoryObj = { ...InputBox.ManyLines, name: 'Many lines' }
export const TooLongForTheBox: StoryObj = { ...InputBox.TooLongForTheBox, name: 'Longer than the box: it scrolls' }
export const PointingAtTheMic: StoryObj = { ...InputBox.PointingAtTheMic, name: 'Pointing at the mic' }
export const PointingAtSend: StoryObj = { ...InputBox.PointingAtSend, name: 'Pointing at Send' }
export const PointingAtAdd: StoryObj = { ...InputBox.PointingAtAdd, name: 'Pointing at + (add pictures or files)' }
