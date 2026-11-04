// The sidebar as the page draws it: the projects as Taska last listed them, in your order, through the page's own
// sideProjects (this one, Shop, with this page's counts from the item list's demo project) and sideLinks, drawn by the
// page's Sidebar and Rail. Used by the sidebar's stories.
import type { ReactNode } from 'react'
import { sideProjects } from '../app/sideProjects'
import { Rail, Sidebar, type SidebarEvents } from '../features/sidebar/Sidebar'
import { SIDE_KEYS, sideLinks } from '../features/sidebar/sideLinks'
import type { ProjectRow } from '../model/types'
import { modelOf } from './fixtures'
import { PROJECT } from './listFixtures'

export const sideOn: SidebarEvents = { newInput() {}, newVoice() {}, newProject() {}, hide() {}, settings() {}, help() {}, keys() {}, go: (_, e) => e.preventDefault(), undo() {}, order() {}, dragProject: () => false, dropProject() {}, projectMenu() {} }
/** The projects as Taska last listed them, in your order. */
const ROWS: ProjectRow[] = [
  { name: 'home', title: 'Home', open: 13, needs: 11, pos: 0 },
  { name: 'shop', title: 'Shop', open: 0, needs: 0, pos: 1 },
  { name: 'notes', title: '\u8bfb\u4e66\u7b14\u8bb0', open: 2, needs: 1, pos: 2 },
  { name: 'long', title: 'A project with a very long name that does not fit', open: 0, needs: 0, pos: 3 },
]
const DEV = [
  { label: 'Storybook', href: '#', icon: 'book' as const },
  { label: 'Dashboard', href: '#', icon: 'chart' as const },
]
const projects = (drop?: string) => {
  const list = sideProjects(ROWS, modelOf(PROJECT, [], { title: 'Shop' }), 'shop').list
  return list && drop ? list.map((p) => (p.slug === drop ? { ...p, drop: true } : p)) : list
}
export const side = (phone: boolean, f: { side?: 'docs' | 'log' | 'deleted'; undo?: string; composing?: boolean; drop?: string; newProject?: ReactNode; loading?: boolean } = {}) => (
  <Sidebar phone={phone} keys={SIDE_KEYS} projects={f.loading ? null : projects(f.drop)} composing={!!f.composing} links={sideLinks('shop', f.side ?? null)} undoLabel={f.undo ?? null} devLinks={phone ? [] : DEV} newProjectField={f.newProject} place={phone ? 'h-full bg-zinc-100' : 'h-full bg-zinc-50'} on={sideOn} />
)
/** the sidebar folded to icons; `settings`: Settings open (its icon lit), `composing`: New input lit, `loading`: projects never listed yet */
export const rail = (f: { settings?: boolean; composing?: boolean; loading?: boolean; side?: 'docs' | 'log' | 'deleted' } = {}) => <Rail keys={SIDE_KEYS} projects={f.loading ? null : projects()} links={sideLinks('shop', f.side ?? null)} composing={f.composing ?? true} settingsOpen={!!f.settings} on={sideOn} />
