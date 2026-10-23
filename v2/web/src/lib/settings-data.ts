// Settings (B162): one page for everything you change now and then. Each section has its own address.
// section: [address, icon, name, what it is for]
import type { IconName } from './icons'
import { projTitle } from './state'

export const PSEC: Record<string, [string, IconName, string, string | (() => string)]> = {
  agents: [
    'agents',
    'bot',
    'Agents',
    () => `Who works on ${projTitle()}, whether they continue automatically, and how to connect more.`,
  ],
  docs: ['docs', 'file', 'Documents', 'Newest first. Open one with its item.'],
  log: ['log', 'history', 'Activity', 'What happened here, newest first. Undo puts back your changes.'],
  deleted: ['deleted', 'trash', 'Deleted', 'Deleted inputs, items, and documents. Restore puts them back.'],
  projects: ['projects', 'folder', 'Projects', 'Rename projects without breaking agent or phone links.'],
  phone: ['phone', 'phone', 'Use on your phone', 'Open Taska from anywhere with a link or key.'],
  notifications: [
    'notifications',
    'alert',
    'Notifications',
    'Alerts when something needs you: in an open browser or on the phone with Taska closed.',
  ],
  fixes: ['spellings', 'pencil', 'Voice spellings', 'Add one by selecting wrong words in a voice note.'],
  organizer: ['organizer', 'sparkle', 'Organizer', 'Turns what you say into items across all projects.'],
}
export const PSEC_THIS = ['agents'] // the rest are for all projects
export const PSEC_SIDE = ['docs', 'log', 'deleted'] // T274 #20: not settings; the sidebar opens them
