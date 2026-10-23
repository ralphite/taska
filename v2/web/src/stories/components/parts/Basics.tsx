// T457: the small parts everything else is made of: icons, the state of an item, keys, a project's tile, an agent's
// mark, counts, marks of a draft, section heads, empty places, search hits.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar, Hit, Icon, Kbd, ProjTile, StateIcon } from '../../../components/ui'
import { ICON, type IconName } from '../../../lib/icons'
import { ICON_USES } from '../../generated/iconUses'
import { STATUS } from '../../../lib/constants'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: ['Icon', 'StateIcon', 'Kbd', 'ProjTile', 'Avatar', 'Hit'],
  },
}
export type Story = StoryObj

/** Every icon the page uses, with its name. */
/** Every icon the page uses, and the parts of the page that use it (T513: made from the code at every build, so
 * none is missing); then the icons in the set that nothing uses. */
export const Icons: Story = {
  render: () => {
    const names = Object.keys(ICON) as IconName[]
    const used = names.filter((n) => ICON_USES[n]?.length),
      unused = names.filter((n) => !ICON_USES[n]?.length)
    const row = (n: IconName) => (
      <li key={n} className="flex items-start gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg text-zinc-800 ring-1 ring-zinc-200 dark:text-zinc-100 dark:ring-zinc-700">
          <Icon n={n} c="size-6" />
        </span>
        <span className="w-24 shrink-0 pt-2 font-mono text-[13px] font-semibold">{n}</span>
        <span className="min-w-0 flex-1 pt-2 text-[13px] text-zinc-600 dark:text-zinc-400">
          {(ICON_USES[n] || [])
            .map((u) => `${u.in} (${u.file.replace(/^components\/|^lib\/|^pages\//, '')})`)
            .join(' \u00b7 ') || 'Not used anywhere'}
        </span>
      </li>
    )
    return (
      <div className="max-w-4xl p-6">
        <h2 className="mb-1 text-base font-semibold">Used on the page ({used.length})</h2>
        <ul className="mb-8">{used.map(row)}</ul>
        <h2 className="mb-1 text-base font-semibold">In the icon set, not used ({unused.length})</h2>
        <ul>{unused.map(row)}</ul>
      </div>
    )
  },
}
/** An item's state, as its round icon. */
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3 p-6">
      {Object.entries(STATUS).map(([s, label]) => (
        <div key={s} className="flex items-center gap-3 text-sm">
          <StateIcon s={s} />
          {label}
        </div>
      ))}
    </div>
  ),
}
export const Keys: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6">
      {['J', 'K', '⇧J', 'E', '.', '/', '⌘K', 'Esc', '⌥V'].map((k) => (
        <Kbd key={k} k={k} />
      ))}
    </div>
  ),
}
export const ProjectTiles: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-6">
      {['shop', 'mobile-app', 'website', 'taska', 'lumina'].map((p) => (
        <ProjTile key={p} name={p} cls="size-9 rounded-lg text-base" />
      ))}
      {['shop', 'mobile-app', 'website'].map((p) => (
        <ProjTile key={'s' + p} name={p} />
      ))}
    </div>
  ),
}
/** Who wrote: each agent's mark. */
export const AgentMarks: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-6">
      {['claude-code', 'codex', 'antigravity', 'agent', 'org'].map((a) => (
        <span key={a} className="flex items-center gap-2 text-sm">
          <Avatar by={a} />
          {a}
        </span>
      ))}
    </div>
  ),
}
/** The words you searched, marked where they show. */
export const SearchHit: Story = {
  render: () => (
    <p className="p-6 text-[15px]">
      <Hit
        text={'\u5bfc\u51fa CSV \u65f6\u53ea\u5bfc\u51fa\u7b5b\u9009\u540e\u770b\u5230\u7684\u884c'}
        words={['\u5bfc\u51fa', 'csv']}
      />
    </p>
  ),
}
