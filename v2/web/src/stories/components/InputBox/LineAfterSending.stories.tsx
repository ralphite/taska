// T512, B515: Input box > Line after sending: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/Line after sending' }
export default meta

export const Sending: StoryObj = {
  ...InputBox.Sending,
  name: 'Sending',
  parameters: { ...InputBox.Sending.parameters, platform: 'phone' },
}
export const NotSent: StoryObj = {
  ...InputBox.NotSent,
  name: 'Not sent',
  parameters: { ...InputBox.NotSent.parameters, platform: 'phone' },
}
export const WaitingForTaska: StoryObj = {
  ...InputBox.WaitingForTaska,
  name: 'Waiting for Taska',
  parameters: { ...InputBox.WaitingForTaska.parameters, platform: 'phone' },
}
export const Filed: StoryObj = {
  ...InputBox.Filed,
  name: 'Filed by your agent',
  parameters: { ...InputBox.Filed.parameters, platform: 'phone' },
}
