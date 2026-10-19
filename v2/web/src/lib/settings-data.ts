// Settings (B162): one page for everything you change now and then. Each section has its own address.
// section: [address, icon, name, what it is for]
import { projTitle } from './state'

export const PSEC: Record<string, [string, string, string, string | (() => string)]> = {
  agents: [
    'agents',
    'bot',
    'Agents',
    () =>
      `The coding agents that work on ${projTitle()}: who is here, whether they go on by themselves, and how to connect one more.`,
  ],
  docs: [
    'docs',
    'file',
    'Documents',
    'Every document in this project, the newest first. Open one to read it with its item.',
  ],
  log: [
    'log',
    'history',
    'Activity',
    'What agents and you did in this project, newest first. Undo puts back one of your own changes.',
  ],
  deleted: [
    'deleted',
    'trash',
    'Deleted',
    'Inputs, items and documents you deleted, and what went with them. Restore puts them back as they were.',
  ],
  projects: [
    'projects',
    'folder',
    'Projects',
    'Every project on this Taska. Give a project any name; its address never changes, so agents and phone links keep working.',
  ],
  phone: [
    'phone',
    'phone',
    'Use on your phone',
    'Open Taska on your phone from anywhere, with a link or with the key.',
  ],
  notifications: [
    'notifications',
    'alert',
    'Notifications',
    'An alert when something needs you in any project: on a computer while Taska is open, on the phone even when it is closed.',
  ],
  fixes: [
    'spellings',
    'pencil',
    'Voice spellings',
    "Every project's voice notes write these your way. To add one, select the wrong words in a voice note.",
  ],
  organizer: ['organizer', 'sparkle', 'Organizer', 'What turns what you say into items, for every project.'],
}
export const PSEC_THIS = ['agents'] // the rest are for all projects
export const PSEC_SIDE = ['docs', 'log', 'deleted'] // T274 #20: not settings; the sidebar opens them
