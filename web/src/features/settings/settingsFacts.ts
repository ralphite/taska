// What Settings' sections show, from the model and what the page has: Projects (this one with this page's counts),
// Documents, Activity and Deleted.
// Pure: the container and the stories both use it.

import type { ListedProject } from '../../app/sideProjects'
import { activityRows } from '../../model/activity'
import { listedDocs } from '../../model/docs'
import type { ProjectModel } from '../../model/project'
import { dayShort, when } from '../../model/time'
import type { LogRow, ProjectRow } from '../../model/types'
import type { DeletedProject } from '../../stores/settings'
import { inputCode, plural } from '../../model/words'
import type { GoneInputRow, GoneThingRow, PhoneDocRow } from './PhoneSections'
import type { ProjectsFacts } from './Sections'
import type { NavFacts } from './SettingsNav'

/** Projects: every project (this one with this page's counts), the deleted ones, and the section's state. */
export function projectsOf(
  projects: readonly ProjectRow[] | null | undefined,
  side: readonly ListedProject[] | null,
  st: { deleted: readonly DeletedProject[] | null; pNew: boolean; pNewText: string; pErr: string; renaming: string | null; pMenu: string | null },
  asked: Readonly<Record<string, number>>,
  file: string,
): ProjectsFacts {
  return {
    live: projects && side ? side.map((p) => ({ name: p.slug, title: p.title, tone: p.tone, open: typeof p.open === 'number' ? p.open : 0, here: p.current })) : null,
    gone: (st.deleted || []).map((d) => ({ name: d.name, title: d.title, when: dayShort(d.t), items: d.items })),
    file,
    pNew: st.pNew,
    pNewText: st.pNewText,
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

/** Deleted: the items and documents, and what you said. */
export const deletedRows = (m: ProjectModel): { things: GoneThingRow[]; inputs: GoneInputRow[] } => ({
  things: m.facts.deleted.map((x) => ({
    label: x.kind === 'item' ? x.code || '' : `D${x.d}`,
    title: x.title,
    what: x.kind === 'item' ? `Item${x.more ? `, with ${plural(x.more, 'subitem')}` : ''}` : `Document${x.on ? ` on ${x.on}` : ''}`,
    at: when(x.at, m.at),
  })),
  inputs: m.facts.deletedInputs.map((x) => ({ id: x.id, code: inputCode(x.id), t: when(x.t, m.at), at: when(x.at, m.at), text: x.text || (x.files ? plural(x.files, 'file') : ''), items: x.items })),
})


/** The way through Settings: what each section's row says on its right (`said`: what the page knows of
 * notifications, projects and spellings). */
export function navFacts(m: ProjectModel | null, said: { notifications: string; projects: number | ''; spellings: number | '' }): NavFacts {
  return { right: { notifications: said.notifications, projects: said.projects, spellings: said.spellings, organizer: m?.facts.organizer.on ? 'On' : 'Off' } }
}
