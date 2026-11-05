// What Settings' sections show, from the model and what the page has: Projects (this one with this page's counts),
// Documents, Activity and Deleted.
// Pure: the container and the stories both use it.

import type { ListedProject } from '../../app/sideProjects'
import { activityRows } from '../../model/activity'
import { listedDocs } from '../../model/docs'
import type { ProjectModel } from '../../model/project'
import { dayShort } from '../../model/time'
import type { LogRow, ProjectRow } from '../../model/types'
import type { DeletedProject } from '../../stores/settings'
import type { PhoneDocRow } from './PhoneSections'
import type { ProjectsFacts } from './Sections'
import type { NavFacts } from './SettingsNav'

/** Projects: every project (this one with this page's counts), the deleted ones, and the section's state. */
export function projectsOf(
  projects: readonly ProjectRow[] | null | undefined,
  side: readonly ListedProject[] | null,
  st: { deleted: readonly DeletedProject[] | null; pErr: string; renaming: string | null; pMenu: string | null },
  asked: Readonly<Record<string, number>>,
  file: string,
): ProjectsFacts {
  return {
    live: projects && side ? side.map((p) => ({ name: p.slug, title: p.title, tone: p.tone, open: typeof p.open === 'number' ? p.open : 0, here: p.current })) : null,
    gone: (st.deleted || []).map((d) => ({ name: d.name, title: d.title, when: dayShort(d.t), items: d.items })),
    file,
    pErr: st.pErr,
    renaming: st.renaming,
    purging: new Set(Object.keys(asked).filter((k) => k.startsWith('purge ')).map((k) => k.slice(6))),
    menu: st.pMenu,
  }
}

/** Documents, newest first, each with its item. */
export const docRows = (m: ProjectModel): PhoneDocRow[] => listedDocs(m)

/** Activity: each change in words, and whether it can be undone. */
export const logRows = (m: ProjectModel, rows: readonly LogRow[]) => activityRows(m, rows)



/** The way through Settings: what each section's row says on its right (`said`: what the page knows of
 * notifications, projects and spellings). */
export function navFacts(m: ProjectModel | null, said: { notifications: string; projects: number | ''; spellings: number | '' }): NavFacts {
  return { right: { notifications: said.notifications, projects: said.projects, spellings: said.spellings, organizer: m?.facts.organizer.on ? 'On' : 'Off' } }
}
