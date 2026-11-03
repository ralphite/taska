// The menu opened by a right-click on a row; its rows under the pointer, from the keys, pressed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AT_POINTER } from '../../stories/menuFixtures'
import { ROW, desk } from '../../stories/itemMenuFixtures'

export default { title: 'Components/Around the page/Menus and sheets/Item menu/Opening it' } satisfies Meta
type Story = StoryObj

/** The desktop: a right-click on a row opens it at the pointer. */
export const RowRightClick: Story = { ...desk({ n: 5, at: AT_POINTER(360, 300) }, {}), name: 'Right-click on a row' }
export const ItemMenuHover: Story = { ...desk({ n: 1 }, { hover: [ROW] }), name: 'Pointer on a row' }
export const ItemMenuKeys: Story = { ...desk({ n: 1 }, { focusVisible: [ROW] }), name: 'Keys: Tab on a row' }
export const ItemMenuPressed: Story = { ...desk({ n: 1 }, { hover: [ROW], active: [ROW] }), name: 'A row pressed' }
