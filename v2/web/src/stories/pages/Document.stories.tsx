// T521: Pages > Document: the page with a document open, in each kind a document comes in
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Document', parameters: pageParams() }
export default meta

export const WithComments: StoryObj = { ...screen(SHOP + 'D1'), name: 'With comments' }
export const LongWithContents: StoryObj = { ...screen(SHOP + 'D3'), name: 'Long, with contents' }
export const WebPage: StoryObj = { ...screen(SHOP + 'D2'), name: 'Web page' }
export const WithChoices: StoryObj = { ...screen(SHOP + 'D4'), name: 'With choices' }
