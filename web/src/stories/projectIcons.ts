// Pictures agents set on projects (F743, `project icon f12-logo.png`), for the stories: a filled app icon (Taska's own),
// another filled one (Home), a see-through favicon (the notes: a dark glyph, on the tile's light plate in either theme)
// and one whose file is gone (the long one: its letter again, as when a picture does not load). The page reads each from
// the project's file (`/p/<slug>/f/<f>`); a story has no Taska, so it names these copies instead.
import HOME from './assets/project-icons/home.svg?url'
import NOTES from './assets/project-icons/notes.svg?url'
import TASKA from './assets/project-icons/taska.png'

export const PROJECT_ICONS: Readonly<Record<string, string>> = { taska: TASKA, home: HOME, notes: NOTES, long: '/p/long/f/f9-gone.png' }

/** A project as listed, with its picture as the stories have it (none: its letter). */
export const withIcon = <P extends { slug: string }>(p: P): P & { icon?: string } => ({ ...p, icon: PROJECT_ICONS[p.slug] })
