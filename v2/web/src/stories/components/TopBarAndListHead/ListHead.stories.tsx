// T512, B515: Top bar and list head > List head: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Top bar and list head/List head' }
export default meta

export const ListHead: StoryObj = { ...Frame.ListHead, name: 'Search box' }
export const ListHeadSearching: StoryObj = { ...Frame.ListHeadSearching, name: 'Searching' }
/** T522 (r731): every look under the pointer, the keyboard, side by side. */
export const ListHeadLooks: StoryObj = { ...Frame.ListHeadLooks, name: 'Pointer, keys, typing: all side by side' }
