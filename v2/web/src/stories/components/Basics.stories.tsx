// T457: the small parts everything else is made of: icons, the state of an item, keys, a project's tile, an agent's
// mark, counts, marks of a draft, section heads, empty places, search hits.
import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Armed,
  Avatar,
  Cnt,
  DraftMark,
  Empty,
  Hit,
  Html,
  Icon,
  Kbd,
  Lines,
  ProjTile,
  SectionHead,
  Soft,
  StateIcon,
} from '../../components/ui'
import { ICON, type IconName } from '../../lib/icons'
import { STATUS } from '../../lib/constants'

const meta: Meta = {
  title: 'Components/Basics',
  parameters: {
    covers: [
      'Icon',
      'StateIcon',
      'Kbd',
      'ProjTile',
      'Avatar',
      'Html',
      'Hit',
      'Soft',
      'Cnt',
      'DraftMark',
      'SectionHead',
      'Empty',
      'Lines',
      'Armed',
    ],
  },
}
export default meta
type Story = StoryObj

/** Every icon the page uses, with its name. */
export const Icons: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-2 p-6 lg:grid-cols-8">
      {(Object.keys(ICON) as IconName[]).map((n) => (
        <div key={n} className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-zinc-700 dark:text-zinc-300">
          <Icon n={n} c="size-6" />
          <span className="text-[11px] text-zinc-500">{n}</span>
        </div>
      ))}
    </div>
  ),
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
export const SmallParts: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-6 text-sm">
      <div className="flex items-center gap-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <Soft>Later</Soft>
        <Cnt icon="comment" n={8} label="8 comments" />
        <Cnt icon="subitems" n="1/2" label="Subitems finished" />
        <DraftMark />
        <DraftMark small />
      </div>
      <SectionHead text="Documents" right={<span className="text-xs text-zinc-400">4</span>} />
      <Empty>No items yet.</Empty>
      <Lines
        lines={[
          'T03 \u5199\u9000\u8d27\u653f\u7b56\u9875',
          'B36 \u4f18\u60e0\u5238\u548c\u793c\u54c1\u5361',
          'F37 \u5546\u54c1\u9875\u663e\u793a\u201c\u8fd8\u5269 N \u4ef6\u201d',
        ]}
      />
      <Armed k="del" ask="Click again to delete">
        <button className="rounded-lg px-3 py-1.5 text-red-600">Delete</button>
      </Armed>
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
export const SafeHtml: Story = {
  render: () => <Html className="p-6 text-sm" html={'<b>Bold</b>, <a href="#">a link</a>, <code>code</code>'} />,
}
