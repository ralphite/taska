// T521: Pages > Projects: the home page with every project, and a small and an empty project; T522: the home page
// while it loads or Taska refuses, and a link to a project Taska does not have (the real page, only Taska answers
// otherwise)
import type { Meta, StoryObj } from '@storybook/react-vite'
import { pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Projects', parameters: pageParams('Home') }
export default meta

export const Home: StoryObj = { ...screen('/'), name: 'Home: every project' }
/** Where you land after deleting the project you were in, with Restore. */
export const ProjectDeleted: StoryObj = { ...screen('/?gone=default'), name: 'Home after a project was deleted' }
export const SmallProject: StoryObj = { ...screen('/p/mobile-app/'), name: 'Small project' }
export const EmptyProject: StoryObj = { ...screen('/p/website/'), name: 'Empty project' }
/** T522: Taska has not answered yet (and no list is kept in this browser): "Loading…" in the table. */
export const HomeLoading: StoryObj = { ...screen('/', undefined, { net: { '^/api/': 'hang' } }), name: 'Home: loading' }
/** T522: Taska refuses: the home page stays at "Loading…" for good; it does not try again or say why. */
export const HomeRefused: StoryObj = {
  ...screen('/', undefined, { net: { '^/api/': 'down' } }),
  name: 'Home: Taska refused',
}
/** T522: a link in the page to a project Taska does not have (nosuch): the page goes home and says it was deleted,
 * with Restore, though it never was. (Typed into the address bar, Taska itself sends you home with no word.) */
export const NoSuchProject: StoryObj = { ...screen('/p/nosuch/'), name: 'A project Taska does not have' }
