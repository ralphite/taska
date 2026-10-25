// The sidebar's links under the projects: Documents, Activity and Deleted of this project, the one whose list shows
// beside the pane lit (while what you opened from it shows too). Pure: the container and the stories both use it.

import type { SideLinkInfo } from './Sidebar'

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
