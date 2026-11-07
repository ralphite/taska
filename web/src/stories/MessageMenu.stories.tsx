// A message's menu (T591: Menus and sheets > Other menus), the page's own part as the page opens it: at the button on
// the desktop, a sheet on the phone. What you said's menu is in InputMenu.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { messageMenuSheet } from '../features/item/ItemSheets'
import { Frames } from './Frames'
import { AT_BUTTON, act, opened } from './menuFixtures'

export default { title: 'UI/Item pane/Talk/Message/Its menu' } satisfies Meta
type Story = StoryObj

const both = (draw: (desk: boolean) => ReturnType<typeof opened>, height = 480): Story => ({ render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => draw(layout === 'desk')}</Frames> })

/** A message's ⋯: hide it from the talk. */
export const MessageMenu: Story = { ...both((desk) => opened(messageMenuSheet(act('Message menu: hide')), desk, { look: desk ? { pop: true, at: AT_BUTTON } : {} }), 320), name: 'Message' }
