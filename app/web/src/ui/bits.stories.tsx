import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { PICTURE } from '../stories/fixtures'
import { Avatar, Count, DraftMark, Empty, Hit, Kbd, Pic, ProjTile, SectionHead, Soft } from './bits'
import { PROJECT_TONES } from './tones'

const meta: Meta = { title: 'Components/Primitives/Bits' }
export default meta
type Story = StoryObj

/** The small parts rows and heads are made of. */
export const Bits: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={560}>
      {() => (
        <States
          items={[
            ['key caps', <div className="flex gap-2 p-3"><Kbd k="⌘" /><Kbd k="K" /><Kbd k="Esc" /></div>],
            ['project tiles, each tone', <div className="flex flex-wrap gap-2 p-3">{PROJECT_TONES.map((t, i) => <ProjTile key={t} title={'Project ' + i} tone={t} />)}</div>],
            ['a big project tile', <div className="p-3"><ProjTile title="Taska" tone={PROJECT_TONES[2]} cls="size-11 rounded-xl text-xl shadow-sm" /></div>],
            ['agents', <div className="flex gap-2 p-3"><Avatar by="claude-code" /><Avatar by="codex" /><Avatar by="gemini" /><Avatar by="org" /><Avatar by="someone" /></div>],
            ['searched words marked', <p className="p-3 text-sm"><Hit text="Export ignores the active filter" words={['export', 'filter']} /></p>],
            ['quiet words, counts, a draft', <div className="flex items-center gap-3 p-3 text-xs"><Soft>Later</Soft><Count icon="comment" n={4} label="4 messages" /><DraftMark /><DraftMark small /></div>],
            ['a section head', <SectionHead text="Needs you" right={<span className="text-xs text-zinc-400">3</span>} />],
            ['an empty list', <Empty>Nothing needs you.</Empty>],
            ['a picture', <div className="size-20 p-3"><Pic src={PICTURE} alt="A screenshot" cls="size-full object-contain" /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}
