// T779 (D134, approved 11-15): a project's rules are a template. A line `{{编程}}` puts the shared rules 编程 there
// (`{{编程 › 测试}}` only its section 测试); Taska keeps the line and gives agents the text in its place. Drawn by the
// page's own Rules tab screens, DocView, DocEdit and Sheet with the stories' shared rules: the lines read as blocks
// that open in place, the editor where they are words like the rest and Insert writes one at the caret (the phone: a
// sheet from the bottom), a name not found, and the text an agent reads. A shared rule's own page: Pages › A shared
// rule's page.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { popAt } from '../../app/page/sheets'
import { hasLine, lineOf, notFound, usedCount } from '../../model/includes'
import { when } from '../../model/time'
import { Rich } from '../../ui/Markdown'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { acts } from '../../stories/acts'
import { docAt, envOf } from '../../stories/docPage'
import { modelOf } from '../../stories/fixtures'
import { Frame, Frames } from '../../stories/Frames'
import { AGENT_TEXT, SHARED_RULES, TASKA_BROKEN, TASKA_RULES, taskaRules, useLines } from '../../stories/sharedRulesFixtures'
import { DocEdit } from './DocEdit'
import { InsertList, NotFoundHint, SharedButton } from './Include'
import { RulesEditing, RulesReading, type RulesFrame } from './RulesScreens'

export default { title: 'UI/Rules tab/Shared rules', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const on = acts('Rules', ['history', 'copy', 'edit', 'leave', 'discard', 'save', 'mic', 'open', 'pick', 'settings'] as const, {
  edit: 'UI › Rules tab › Shared rules › Editing: the lines as text',
  open: 'UI › Rules tab › Shared rules › Editing: insert shared rules',
})
const env = (desk: boolean) => envOf(modelOf([]), desk)
const NOW = env(true).now
const frame = (desk: boolean): RulesFrame => ({ desk, place: '' })
const screens = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => <Frames height={852} deskWidth={1000} phoneWidth={393}>{(layout) => <div className="flex h-full flex-col">{draw(layout === 'desk')}</div>}</Frames>,
})

function Reading({ desk, md, open = [] }: { desk: boolean; md: string; open?: string[] }) {
  const lines = useLines(env(desk).world, open)
  return <RulesReading f={frame(desk)} sub={`v6 · You · ${when(taskaRules(md).t1, NOW)}`} proposals={[]} doc={docAt(taskaRules(md), desk, { viewOnly: true, lines })} on={on} />
}

// ---------------------------------------------------------------- reading

/** Taska's rules: {{通用}} and {{编程}} closed, each a dashed block that says how many projects use it; then Taska's
 * own rules as the tab reads them. */
export const ReadingClosed: Story = { ...screens((desk) => <Reading desk={desk} md={TASKA_RULES} />), name: 'Reading: the lines closed' }

/** {{编程}} opened: its text in place (a click on the block opens or closes it; its name goes to that shared rule). */
export const ReadingOpened: Story = { ...screens((desk) => <Reading desk={desk} md={TASKA_RULES} open={['编程']} />), name: 'Reading: one opened in place' }

/** {{编程X}}: no shared rules by that name; the block says so in red (an agent reading the rules is told the same). */
export const NotFoundReading: Story = { ...screens((desk) => <Reading desk={desk} md={TASKA_BROKEN} />), name: 'Not found: reading' }

// ---------------------------------------------------------------- editing

function Editor({ desk, md, picking = false }: { desk: boolean; md: string; picking?: boolean }) {
  const [text, setText] = useState(md)
  const [why, setWhy] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<ReturnType<typeof popAt> | null>(null)
  useLayoutEffect(() => {
    // the desktop's list opens at its button, as the page's menus open at theirs
    const el = box.current
    const btn = [...(el?.querySelectorAll('button') ?? [])].find((b) => b.title === 'Insert shared rules')
    const f = el?.closest('[class*="@container/frame"]')?.getBoundingClientRect()
    if (!picking || !desk || !btn || !f) return
    const r = btn.getBoundingClientRect()
    setAt(popAt({ left: r.left - f.left, right: r.right - f.left, top: r.top - f.top, bottom: r.bottom - f.top }))
  }, [picking, desk])
  const rows = SHARED_RULES.map((r) => ({ name: r.name, line: lineOf(r.name), count: usedCount(r), parts: r.parts.map((p) => ({ name: p.name, line: lineOf(r.name, p.name) })) }))
  const editor = (
    <DocEdit
      isNew={false}
      text={text}
      hint={<NotFoundHint labels={notFound(text, SHARED_RULES)} hint={desk ? 'Esc keeps draft' : ''} />}
      mic={{ on: false, text: 'Speak' }}
      tools={<SharedButton onClick={on.open} />}
      on={{ change: setText, discard: on.discard, save: on.save, mic: on.mic }}
    />
  )
  return (
    <div ref={box} className="relative flex h-full flex-col">
      <RulesEditing f={frame(desk)} why={why} editor={editor} on={{ why: setWhy, leave: on.leave }} />
      {picking ? (
        <Sheet open={!desk || !!at} look={desk ? { pop: true, at } : {}} desk={desk} onClose={on.leave}>
          <SheetLayout menu title="Insert shared rules" body={<InsertList rows={rows} has={(l) => hasLine(text, l)} on={on} />} />
        </Sheet>
      ) : null}
    </div>
  )
}

/** Edit: the whole text in the page's editor; the lines are words like the rest (moved, removed or written by hand,
 * by you or an agent's proposal). The bar has Shared (the desktop: Insert shared rules). */
export const EditingLines: Story = { ...screens((desk) => <Editor desk={desk} md={TASKA_RULES} />), name: 'Editing: the lines as text' }

/** Insert shared rules: each shared rule (and its sections), those the text puts in ticked; a pick writes its line at
 * the caret, on a line of its own. The desktop: at its button; the phone: from the bottom. */
export const EditingInsert: Story = { ...screens((desk) => <Editor desk={desk} md={TASKA_RULES} picking />), name: 'Editing: insert shared rules' }

/** While writing: the name not found, in red beside the buttons; it goes once the line is right. */
export const NotFoundEditing: Story = { ...screens((desk) => <Editor desk={desk} md={TASKA_BROKEN} />), name: 'Not found: editing' }

// ---------------------------------------------------------------- what an agent reads

/** What GET /rules gives Taska's agents for its rules (the server's own text): first that the project's own words win,
 * then each line replaced by its text, each heading of it saying which shared rules it came from. */
export const AgentText: Story = {
  name: 'What an agent reads',
  render: () => (
    <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
      <Frame layout="desk" width={1000} label="what an agent reads">
        <div className="px-8 pt-8 pb-12 text-[15px]">
          <Rich text={'```\n' + AGENT_TEXT + '\n```'} world={env(true).world} />
        </div>
      </Frame>
    </div>
  ),
}
