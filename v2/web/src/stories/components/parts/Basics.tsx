// T457: the small parts everything else is made of: icons, the status of an item, keys, a project's tile, an agent's
// mark, search hits. Each story shows the part as the page draws it, on the demo's data.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar, Hit, Icon, Kbd, ProjTile, StateIcon } from '../../../components/ui'
import type { IconName } from '../../../lib/icons'
import { ICON_USES } from '../../generated/iconUses'
import { RULE_STATUS, STATUS, STATUS_FILTER } from '../../../lib/constants'
import { DR, whoName } from '../../../lib/state'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: ['Icon', 'StateIcon', 'Kbd', 'ProjTile', 'Avatar', 'Hit'],
  },
}
export type Story = StoryObj

/** Every icon the page uses, with its name. */
/** Every icon the page uses, with its name. The list is made from the code at every build (T513: an icon the page
 * uses and the gallery lacks fails the build), so none can be missing. */
export const Icons: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-2 p-6 lg:grid-cols-8">
      {(Object.keys(ICON_USES) as IconName[]).map((n) => (
        <div key={n} className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-zinc-700 dark:text-zinc-300">
          <Icon n={n} c="size-6" />
          <span className="text-[11px] text-zinc-500">{n}</span>
        </div>
      ))}
    </div>
  ),
}
// a status's round icon, with the word the page says for it
const statuses = (words: Partial<Record<string, string>>) => (
  <div className="flex flex-col gap-3 p-6">
    {Object.entries(words).map(([s, label]) => (
      <div key={s} className="flex items-center gap-3 text-sm">
        <StateIcon s={s} label={label} />
        {label}
      </div>
    ))}
  </div>
)
/** An item's status, as its round icon; last, Needs you, which an item shows instead while an agent's ask or block
 * waits on you (R055, B535). */
export const States: Story = { render: () => statuses({ ...STATUS, wait: STATUS_FILTER.wait }) }
/** A rule's status: the same icons, with the words the page says for a rule (Active, Retired). */
export const RuleStates: Story = { render: () => statuses(RULE_STATUS) }
/** The keys the page shows beside a button or in a hint. Only the desktop shows them (a phone has no keys). */
export const Keys: Story = {
  parameters: { platform: 'desktop' },
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6">
      {['J', 'K', '⇧J', 'A', 'W', 'N', 'C', 'G S', '?', '↵', '⇧↵', '⌘↵', 'Esc'].map((k) => (
        <Kbd key={k} k={k} />
      ))}
    </div>
  ),
}
/** The demo's projects, in each size the page draws a project's tile, largest first (the New input page, home and
 * settings, the rail and sheets, the sidebar and top bar, the default, a list row, the settings head). */
export const ProjectTiles: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-6">
      {[
        'size-11 rounded-xl text-xl shadow-sm',
        'size-8 rounded-lg text-sm',
        'size-7 rounded-lg text-sm',
        'size-7 rounded-lg text-xs',
        'size-6 rounded-md text-xs',
        undefined,
        'size-5 rounded text-[10px]',
        'size-4 rounded text-[9px]',
      ].map((cls) => (
        <div key={cls || 'default'} className="flex items-center gap-3">
          {(DR.list || []).map((p) => (
            <ProjTile key={p.name} name={p.name} cls={cls} />
          ))}
        </div>
      ))}
    </div>
  ),
}
/** Who wrote: each agent's mark, with the name the page shows beside it; the last is an agent Taska has no mark for. */
export const AgentMarks: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-6">
      {['claude-code', 'codex', 'antigravity', 'agent', 'org', 'gemini'].map((a) => (
        <span key={a} className="flex items-center gap-2 text-sm">
          <Avatar by={a} />
          {whoName(a)}
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
