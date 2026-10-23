// T521: Pages > Projects: the home page with every project, and a small and an empty project
import type { Meta, StoryObj } from '@storybook/react-vite'
import { pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Projects', parameters: pageParams('Home') }
export default meta

export const Home: StoryObj = { ...screen('/'), name: 'Home: every project' }
/** Where you land after deleting the project you were in, with Restore. */
export const ProjectDeleted: StoryObj = { ...screen('/?gone=default'), name: 'Home after a project was deleted' }
export const SmallProject: StoryObj = { ...screen('/p/mobile-app/'), name: 'Small project' }
export const EmptyProject: StoryObj = { ...screen('/p/website/'), name: 'Empty project' }
