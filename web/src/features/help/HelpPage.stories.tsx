// Help as the page draws it, laid out as docs sites are: opened on its first topic, a topic open, the keys' topic, a
// narrower window, the phone's Topics, the topics under the pointer and from the keys. The topics are Help's own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { help } from '../../stories/helpFixtures'

export default { title: 'Components/Help/Topics' } satisfies Meta
type Story = StoryObj

export const Index: Story = { ...help(null), name: 'Opened: the first topic' }
export const ATopic: Story = { ...help('agents'), name: 'A topic open: How agents get work' }
export const ATopicWithATable: Story = { ...help('items'), name: 'A topic with tables: Items' }
export const Keys: Story = { ...help('keys'), name: 'Keyboard shortcuts' }
/** a desktop window too narrow for On this page: the topic and the column only */
export const Narrower: Story = { ...help('items', '', { deskWidth: 1080 }), name: 'A narrower window: no On this page' }
/** the phone's Topics: every topic in its group, the search above them */
export const PhoneTopics: Story = { ...help('agents', '', { menu: true }), name: 'The phone: Topics open' }
/** a topic in the column under the pointer, one from the keys (the browser's ring) */
export const PointerAndKeys: Story = { ...help(null), name: 'The topics: pointer and keys', parameters: { pseudo: { hover: ['nav li:nth-of-type(2) a'], focusVisible: ['nav li:nth-of-type(3) a'] } } }
