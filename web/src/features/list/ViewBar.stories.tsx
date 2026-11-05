import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames, Hold, States } from '../../stories/Frames'
import { act } from '../../stories/menuFixtures'
import { FiltersButton } from './Filters'
import { VIEWS, type ViewChip } from './rows'
import { ViewBar } from './ViewBar'

const meta: Meta = { title: 'Components/Item list/View chips' }
export default meta
type Story = StoryObj

const COUNTS: Record<string, number> = { all: 25, every: 197, archive: 281, open: 9, later: 14, done: 150, dropped: 10 }
/** The page's own views (VIEWS), each with a count. */
const views = (on: string, needs = 2): ViewChip[] =>
  VIEWS.map(([value, label]) => {
    const count = value === 'wait' ? needs : (COUNTS[value] ?? 0)
    return { value, label, count, on: value === on, needs: value === 'wait' && count > 0 }
  })

type Own = { name: string; count: number; on: boolean; editing?: boolean }
/** The bar with the view it shows: a chip shows its view, one of your own views shows it (the page's nav.view and
 * views.show); its menu and renaming show in the Actions panel. */
const bar = (on: string, o: { needs?: number; own?: Own[]; list?: { open: boolean } } = {}) => (
  <Hold start={{ on, own: o.own?.findIndex((v) => v.on) ?? -1, open: !!o.list?.open, filters: false }}>
    {(v, set) => (
      <ViewBar
        views={views(v.own >= 0 ? '' : v.on, o.needs)}
        own={o.own?.map((x, i) => ({ ...x, on: i === v.own }))}
        // the desktop list's: Filters first, ⌄ / ⌃ last (F670)
        {...(o.list
          ? { lead: <FiltersButton set={false} open={v.filters} onClick={() => set({ ...v, filters: !v.filters })} />, more: { open: v.open, toggle: () => set({ ...v, open: !v.open }) } }
          : {})}
        onView={(value) => set({ ...v, on: value, own: -1 })}
        onOwn={(i) => set({ ...v, on: '', own: i })}
        onOwnMenu={act('Views: own view menu')}
        onRename={act('Views: rename')}
        onRenameStop={act('Views: rename stop')}
      />
    )}
  </Hold>
)

/** The row of views: the one shown is dark; more views past the edge fade there, with an arrow on the desktop (the
 * phone swipes). */
export const Views: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['Active', bar('all')],
            ['Needs you, nothing waiting', bar('wait', { needs: 0 })],
            ["Won't do (scrolled to it)", bar('dropped')],
            ['with your own views (slid to the end)', <After run={(r) => r.querySelectorAll('[data-views] > div').forEach((el) => (el.scrollLeft = el.scrollWidth))}>{bar('every', { own: [{ name: 'Bugs now', count: 6, on: false }, { name: 'P0', count: 1, on: false }] })}</After>],
          ]}
        />
      )}
    </Frames>
  ),
}
/** The desktop's list (F670): Filters at the far left; when the views do not fit, ⌄ at the far right opens the row onto
 * as many lines as it takes, your own views too, and ⌃ closes it to one line (kept in this browser). All fitting: no ⌄. */
export const DesktopList: Story = {
  name: 'Desktop list: Filters first, ⌄ shows all',
  render: () => (
    <Frames phone={false} deskWidth={420}>
      {() => (
        <States
          items={[
            ['one line: ⌄ (the views do not fit)', bar('all', { list: { open: false }, own: [{ name: 'Bugs now', count: 6, on: false }, { name: 'P0', count: 1, on: false }] })],
            ['opened onto all its lines: ⌃', bar('all', { list: { open: true }, own: [{ name: 'Bugs now', count: 6, on: false }, { name: 'P0', count: 1, on: false }] })],
          ]}
        />
      )}
    </Frames>
  ),
}
/** wide enough for every view: no ⌄ */
export const DesktopListAllFit: Story = {
  name: 'Desktop list: all fit, no ⌄',
  render: () => <Frames phone={false} deskWidth={1100}>{() => bar('all', { list: { open: false } })}</Frames>,
}
// ---- more states (B636)
export const YourOwnViewShownBeingRenamed: Story = {
  name: 'Your own view: shown, being renamed',
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['Your own view shown', bar('', { own: [{ name: 'Bugs first', count: 6, on: true }] })],
            ['Being renamed', bar('', { own: [{ name: 'Bugs first', count: 6, on: true, editing: true }] })],
          ]}
        />
      )}
    </Frames>
  ),
}
// ---- more states (T639)
/** a chip under the pointer, one from the keys (the browser's ring), and the edge arrow under the pointer: the
 * desktop's (the phone has neither pointer nor arrows) */
export const PointerAndKeys: Story = {
  name: 'Pointer and keys',
  parameters: { pseudo: { hover: ['[data-look="pointer"] button:nth-of-type(3)', '[data-look="arrow"] button[aria-label] > span'], focusVisible: ['[data-look="keys"] button:nth-of-type(3)'] } },
  render: () => (
    <Frames phone={false} deskWidth={460}>
      {() => (
        <States
          items={[
            ['a chip under the pointer', <div data-look="pointer">{bar('all')}</div>],
            ['a chip from the keys', <div data-look="keys">{bar('all')}</div>],
            ['the edge arrow under the pointer', <div data-look="arrow">{bar('all')}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
