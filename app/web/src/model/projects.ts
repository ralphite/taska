// The projects as the home page lists them: in your order (as dragged in the sidebar), the rest the latest first.

import type { ProjectRow } from './types'

export const homeOrder = (rows: readonly ProjectRow[]): ProjectRow[] => [...rows].sort((a, b) => (a.pos ?? 1e9) - (b.pos ?? 1e9) || (b.t || 0) - (a.t || 0))
