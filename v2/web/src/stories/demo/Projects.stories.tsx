// T457, R488, D68 (9): projects, played by itself on the real page: go from one project to another. On the phone
// the projects are in the drawer behind the menu; on the desktop they are in the sidebar.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Script } from '../lib/player'
import { end, first, tap } from './steps'

const meta: Meta = {
  title: 'Demo/Projects',
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
  globals: { viewport: { value: '100pct-100pct', isRotated: false } }, // the frame fits the room (see Needs you)
}
export default meta
type Story = StoryObj

const MOBILE_APP = 'a[href="/p/mobile-app/"]'
const phone: Script = async (c) => {
  await first(c, 'Shop \u00b7 tap the menu: every project')
  await tap(c, '', '#projBtn')
  await tap(c, 'Projects \u00b7 tap Mobile app', `#drawer ${MOBILE_APP}`)
  await end(c, 'Mobile app \u00b7 its own items')
}
const desktop: Script = async (c) => {
  await first(c, 'Shop \u00b7 every project is in the sidebar')
  await tap(c, 'Sidebar \u00b7 tap Mobile app', MOBILE_APP)
  await end(c, 'Mobile app \u00b7 its items and inputs')
}
export const SwitchProject: Story = {
  name: 'Switch project \u00b7 phone',
  render: (_, { globals }) => <Player path="/p/shop/" script={phone} scheme={String(globals.scheme)} />,
}
export const SwitchProjectOnTheDesktop: Story = {
  name: 'Switch project \u00b7 desktop',
  render: (_, { globals }) => <Player path="/p/shop/" script={desktop} scheme={String(globals.scheme)} on="desktop" />,
}
