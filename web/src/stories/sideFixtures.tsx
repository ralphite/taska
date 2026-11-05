// The sidebar as the page draws it: the projects as Taska last listed them, in your order, through the page's own
// sideProjects (this one, Shop, with this page's counts from the item list's demo project) and sideLinks, drawn by the
// page's Sidebar and Rail. On the desktop it folds to the rail and back, its edge drags it wider or narrower (a
// double-click puts it back), and New project names one, as the page's SidebarContainer does with the page's own
// state (T662); what needs the rest of the page (a project, Settings, Search...) shows in the Actions panel. Used by
// the sidebar's stories.
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { sideProjects } from '../app/sideProjects'
import { Rail, Sidebar, type SidebarEvents } from '../features/sidebar/Sidebar'
import { SIDE_KEYS, sideLinks } from '../features/sidebar/sideLinks'
import type { ProjectRow } from '../model/types'
import { gripVars } from '../stores/grips'
import { Grip } from '../ui/Grip'
import { T, modelOf } from './fixtures'
import { PROJECT } from './listFixtures'
import { act, acts } from './acts'
import { withNewProject } from './newProjectFixtures'

const sideActs = acts('Sidebar', ['newInput', 'newVoice', 'newProject', 'hide', 'settings', 'help', 'keys', 'undo', 'order', 'dropProject', 'projectMenu', 'search'] as const, { keys: 'Keyboard shortcuts', search: 'Search on the desktop' })
const goAct = act('Sidebar: go')
export const sideOn: SidebarEvents = { ...sideActs, go: (href, e) => (e.preventDefault(), goAct(href)), dragProject: () => false }
/** when the projects were listed */
const AT = Date.parse(T)
const ago = (min: number) => AT - min * 60e3
/** The projects as Taska last listed them, in your order: Home busy (Codex was here two hours ago, work waits), the
 * notes quiet for a week, the long one with nothing open. */
const ROWS: ProjectRow[] = [
  { name: 'home', title: 'Home', open: 13, needs: 11, closed: 42, inputs: 120, docs: 6, agents: [{ name: 'codex', t: ago(120), waiting: false }], work: true, t: ago(25), pos: 0 },
  { name: 'shop', title: 'Shop', open: 0, needs: 0, t: ago(3 * 1440), pos: 1 },
  { name: 'notes', title: '\u8bfb\u4e66\u7b14\u8bb0', open: 2, needs: 1, closed: 5, inputs: 9, docs: 0, t: ago(7 * 1440), pos: 2 },
  { name: 'long', title: 'A project with a very long name that does not fit', open: 0, needs: 0, closed: 4, inputs: 3, docs: 1, agents: [{ name: 'claude-code', t: ago(30 * 1440), waiting: false }], t: ago(30 * 1440), pos: 3 },
]
const DEV = [
  { label: 'Storybook', href: '#', icon: 'book' as const },
  { label: 'Dashboard', href: '#', icon: 'chart' as const },
]
const projects = (drop?: string) => {
  const list = sideProjects(ROWS, modelOf(PROJECT, [], { title: 'Shop' }), 'shop', AT).list
  return list && drop ? list.map((p) => (p.slug === drop ? { ...p, drop: true } : p)) : list
}
type SideFacts = { side?: 'docs' | 'log' | 'deleted'; undo?: string; composing?: boolean; drop?: string; naming?: string; namingValue?: string; width?: number; loading?: boolean; settings?: boolean; noLinks?: boolean }
// naming: New project being named (and why it was not made: '' none yet); noLinks: no project open, so no Documents, Activity, Deleted

/** The sidebar with the state the page keeps for it (stores.ui's sideHidden and naming, stores.grips' side width),
 * the frame as the window: it fills the frame until its edge is dragged (dragged past the frame, the frame widens).
 * `folded` starts it as the rail. */
function LiveSidebar({ phone, f, folded = false }: { phone: boolean; f: SideFacts; folded?: boolean }) {
  const [hidden, setHidden] = useState(folded && !phone)
  const [width, setWidth] = useState(f.width ?? 0)
  const frame = useRef<HTMLElement | null>(null)
  const [naming, setNaming] = useState<{ error: string } | null>(f.naming == null ? null : { error: f.naming })
  const on: SidebarEvents = {
    ...sideOn,
    hide: () => setHidden(!hidden),
    newProject: (from) => {
      sideActs.newProject(from)
      setNaming({ error: '' })
    },
  }
  // New project: a popover at its button (the desktop), a sheet (the phone), over the sidebar (D115 #7)
  const naming_ = (under: ReactNode) => (naming ? withNewProject(under, !phone, { beside: hidden, value: f.namingValue, error: naming.error, onDone: () => setNaming(null) }) : under)
  const list = f.loading ? null : projects(f.drop)
  const links = f.noLinks ? [] : sideLinks('shop', f.side ?? null)
  if (hidden) return naming_(<Rail keys={SIDE_KEYS} projects={list} links={links} composing={f.composing ?? true} settingsOpen={!!f.settings} on={on} />)
  const edge = phone ? null : (
    <Grip
      name="side"
      axis="x"
      place="absolute inset-y-0 right-0 z-10 hidden w-3 translate-x-1/2 lg:block"
      measure={(el) => {
        frame.current = el.closest('[data-layout]')
        return { from: el.parentElement?.getBoundingClientRect().left ?? 0, most: innerWidth }
      }}
      onSize={(px) => {
        // dragged past the frame: the frame (the window) widens with it, as you would widen a window
        const fr = frame.current
        if (fr && px + 8 > fr.clientWidth) fr.style.width = px + 8 + 'px'
        setWidth(px)
      }}
      onDone={setWidth}
      onReset={() => setWidth(0)}
    />
  )
  // dragged: the page's own width for it (SidebarContainer's place), the rest of the window the page's
  const sized = width ? 'relative w-[var(--side-w,15rem)] shrink-0 border-r border-zinc-200 dark:border-zinc-800' : 'relative w-full'
  return naming_(
    <div className="flex h-full" style={gripVars({ side: width, list: 0, top: 0, duo: 0 }) as CSSProperties}>
      <Sidebar phone={phone} keys={SIDE_KEYS} projects={list} composing={!!f.composing} links={links} undoLabel={f.undo ?? null} devLinks={phone ? [] : DEV} edge={edge} place={phone ? 'h-full w-full bg-zinc-100' : `h-full bg-zinc-50 ${sized}`} on={on} />
    </div>
  )
}

export const side = (phone: boolean, f: SideFacts = {}) => <LiveSidebar phone={phone} f={f} />
/** the sidebar folded to icons; `settings`: Settings open (its icon lit), `composing`: New input lit, `loading`: projects never listed yet. Show sidebar unfolds it. */
export const rail = (f: Omit<SideFacts, 'undo' | 'drop'> = {}) => <LiveSidebar phone={false} folded f={f} />
/** A mouse comes onto a project (its row in the sidebar, or its icon on the rail, by its name), as the page hears it. */
export const pointTo = (title: string) => (root: HTMLElement) => {
  const a = [...root.querySelectorAll<HTMLElement>('nav a')].find((x) => x.getAttribute('aria-label') === title || x.dataset.slug === title)
  a?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
}
/** Then the mouse moves off the project and into its card (r1066), as the page hears it: it stays open. */
export const pointIntoCard = (title: string) => (root: HTMLElement) => {
  pointTo(title)(root)
  setTimeout(() => {
    const a = [...root.querySelectorAll<HTMLElement>('nav a')].find((x) => x.getAttribute('aria-label') === title || x.dataset.slug === title)
    const card = root.ownerDocument.querySelector('[data-project-card]')
    a?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: card }))
  }, 50)
}
