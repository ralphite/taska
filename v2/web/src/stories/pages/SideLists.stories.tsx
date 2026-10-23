// T521: Pages > Side lists: the lists the sidebar opens (documents, activity, deleted)
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Side lists', parameters: pageParams() }
export default meta

export const Documents: StoryObj = { ...screen(SHOP + 'docs'), name: 'Documents' }
export const Activity: StoryObj = { ...screen(SHOP + 'log'), name: 'Activity' }
export const Deleted: StoryObj = { ...screen(SHOP + 'deleted'), name: 'Deleted' }
