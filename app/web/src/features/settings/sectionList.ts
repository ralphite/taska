// Settings' sections: each with its address, icon, name and what it is for. Agents are this project's; the rest are
// for every project. Documents, Activity and Deleted are lists beside the items on the desktop, and pages here on the
// phone.

import type { Place } from '../../model/route'
import type { IconName } from '../../ui/icon-paths'

export type SectionKey = 'agents' | 'projects' | 'phone' | 'notifications' | 'spellings' | 'organizer' | 'docs' | 'log' | 'deleted'

export const SECTIONS: Record<SectionKey, { path: string; icon: IconName; name: string; about: (title: string) => string }> = {
  agents: { path: 'agents', icon: 'bot', name: 'Agents', about: (t) => `Who works on ${t}, whether they continue automatically, and how to connect more.` },
  docs: { path: 'docs', icon: 'doc', name: 'Documents', about: () => 'Newest first. Open one with its item.' },
  log: { path: 'log', icon: 'history', name: 'Activity', about: () => 'What happened here, newest first. Undo puts back your changes.' },
  deleted: { path: 'deleted', icon: 'trash', name: 'Deleted', about: () => 'Deleted inputs, items, and documents. Restore puts them back.' },
  projects: { path: 'projects', icon: 'folder', name: 'Projects', about: () => 'Rename projects without breaking agent or phone links.' },
  phone: { path: 'phone', icon: 'phone', name: 'Use on your phone', about: () => 'Open Taska from anywhere with a link or key.' },
  notifications: { path: 'notifications', icon: 'bell', name: 'Notifications', about: () => 'Alerts when something needs you: in an open browser or on the phone with Taska closed.' },
  spellings: { path: 'spellings', icon: 'pencil', name: 'Voice spellings', about: () => 'Add one by selecting wrong words in a voice note.' },
  organizer: { path: 'organizer', icon: 'sparkle', name: 'Organizer', about: () => 'Turns what you say into items across all projects.' },
}

export const THIS_PROJECT: SectionKey[] = ['agents']
export const ALL_PROJECTS: SectionKey[] = ['projects', 'phone', 'notifications', 'spellings', 'organizer']

/** The section an address names ("connect" is Agents' part, "about" is Projects). */
export function sectionOf(path: string | null, desk: boolean): SectionKey | null {
  if (path === 'connect') return 'agents'
  if (path === 'about') return 'projects'
  if (path && path in SECTIONS) return path as SectionKey
  return desk ? 'agents' : null
}

/** What the page's title calls a place of Settings: its section (the phone's Documents, Activity and Deleted are its
 * pages), or the phone's list of them; null: not Settings. */
export function settingsTitle(place: Place, desk: boolean): string | null {
  if (place.kind === 'settings') {
    const k = sectionOf(place.section, desk)
    return k ? SECTIONS[k].name : 'Settings'
  }
  return place.kind === 'side' && !desk ? SECTIONS[place.side].name : null
}
