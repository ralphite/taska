// T457 (#6481): projects: every project at a glance, switching, a new one, renaming, deleting and bringing one back.
// Each demo is its steps (./demo.tsx).
import type { Meta } from '@storybook/react-vite'
import { demo, menu, only, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Projects' } satisfies Meta

const website = [
  menu,
  tap('Tap Settings', 'settings'),
  tap('Tap Projects', 'section', 'Projects'),
  only('phone', tap('Tap ... on Website', 'projectMore', 3)),
]

export const SwitchProject = demo({
  steps: [menu, tap('Tap Mobile app', 'mobileApp')],
  done: 'Mobile app: its own items and inputs',
})

export const SeeEveryProject = demo({
  steps: [menu, tap('Tap Taska: the home page', 'home'), { say: 'Every project, and what needs you in each' }],
  done: 'One page for all projects, with Go through for what needs you everywhere',
})

export const StartANewProject = demo({
  steps: [
    menu,
    tap('Tap New project', 'newProject'),
    write('Name it', 'Newsletter', 'projectName'),
    tap('Tap Create', 'createProject'),
  ],
  done: 'A new, empty project, with how to connect an agent to it',
})

export const RenameAProject = demo({
  steps: [
    ...website,
    tap('Tap Rename', 'rename'),
    write('Type its new name', W.renamed, 'renameField'),
    { say: 'Press Enter', key: 'Enter' },
  ],
  done: 'Renamed; its address stays the same',
})

export const DeleteAProjectThenBringItBack = demo({
  steps: [
    ...website,
    tap('Tap Delete: nothing in it is lost', 'deleteProject'),
    tap('Tap Restore: it is back', 'restoreProject', 1),
  ],
  done: 'Deleted projects wait here until you bring them back',
})
