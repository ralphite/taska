// The sidebar's links under the projects: Documents, Activity and Deleted of this project, the one whose list shows
// beside the pane lit (while what you opened from it shows too); and the keys it shows, from the actions' table.
// Pure: the container and the stories both use it.

import { keysShown } from '../../app/actions'
import type { SideKeys, SideLinkInfo } from './Sidebar'

export const SIDE_KEYS: SideKeys = { search: keysShown('palette'), newInput: keysShown('new-input'), voice: keysShown('voice'), settings: keysShown('settings'), sidebar: keysShown('sidebar'), keys: keysShown('keys'), links: { docs: keysShown('documents'), log: keysShown('activity'), deleted: keysShown('deleted') } }

export function sideLinks(slug: string, side: 'docs' | 'log' | 'deleted' | null): SideLinkInfo[] {
  const base = `/p/${encodeURIComponent(slug)}/`
  return slug
    ? [
        { key: 'docs', label: 'Documents', icon: 'doc', href: base + 'docs', current: side === 'docs' },
        { key: 'log', label: 'Activity', icon: 'history', href: base + 'log', current: side === 'log' },
        { key: 'deleted', label: 'Deleted', icon: 'trash', href: base + 'deleted', current: side === 'deleted' },
      ]
    : []
}
