// The project's agent session blocked, waiting on Yadong (T711, Gemini's "floating orange bar", Yadong's choice): on
// every project page, phone and desktop, the bar floats just above the box (on the desktop's New input page, whose box
// is at its top, at the window's bottom), over what is under it, never pushing it. Its Open opens the page's own
// Agents sheet, which says which session and what it waits on. Each page is composed of the page's own parts with the
// demo project Shop. Dark is Storybook's toolbar switch.
import { useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AgentSeen } from '../../model/types'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { Frame, Frames, PHONE, States } from '../../stories/Frames'
import { guide } from '../../stories/guideFixture'
import { AGENTS, headOf } from '../../stories/headFixtures'
import { pageOf } from '../../stories/itemPage'
import { PROJECT, listOf } from '../../stories/listFixtures'
import { DeskPage as NewInputDesk, PhonePage as NewInputPhone } from '../../stories/newInputPage'
import { DeskPage, PageBox } from '../../stories/searchDeskPage'
import { D1, SHOP } from '../../stories/searchFixtures'
import { shopWithHistory } from '../../stories/settingsFixtures'
import { act, acts } from '../../stories/sheetFixtures'
import { agentsSheet } from './Agents'
import { agentsFacts } from './agentsFacts'
import { BlockedBar } from './BlockedBar'

export default { title: 'UI/Agents/Blocked bar', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

/** Claude Code's session asks to run a command (the bar says none of it; the Agents sheet does). */
const BLOCKED: AgentSeen[] = AGENTS.blocked
const SHOP_BLOCKED = { ...SHOP, facts: { ...SHOP.facts, agents: BLOCKED } }
type Layout = 'phone' | 'desk'
const on = acts('Agents', ['copy', 'help', 'open'], { help: 'Help › Topics › Connect an agent', open: 'the item' })

/** Where the page floats it, just above the box: on the phone 16 px from the screen's sides, on the desktop over the
 * pane's column (both as the page places them). */
const ABOVE_BOX: Record<Layout, string> = { phone: 'absolute inset-x-4 bottom-full z-30 mb-3', desk: 'absolute inset-x-6 bottom-full z-30 mb-3' }

/** The page and its Agents sheet: the bar's Open and the head's agent button open it, as on the page. */
function WithSheet({ desk, children }: { desk: boolean; children(open: () => void): ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {children(() => setOpen(true))}
      <Sheet open={open} look={{ tall: true, wide: true }} desk={desk} onClose={() => setOpen(false)}>
        {open ? <SheetLayout {...agentsSheet(agentsFacts(shopWithHistory(BLOCKED), guide('shop')), on)} /> : null}
      </Sheet>
    </>
  )
}

const bar = (layout: Layout, onOpen: () => void, place = ABOVE_BOX[layout]) => <BlockedBar by="claude-code" place={place} onOpen={onOpen} />

/** The phone's list: the head (its agent button blocked), the tabs, the items, the box at the foot, the bar above it. */
function PhoneList() {
  return (
    <WithSheet desk={false}>
      {(open) => (
        <div className="flex h-full flex-col">
          {headOf(false, { agents: BLOCKED, onAgents: open })}
          {listOf(PROJECT, 'items', {}, false)}
          <div className="relative">
            {bar('phone', open)}
            <PageBox m={SHOP_BLOCKED} n={null} desk={false} />
          </div>
        </div>
      )}
    </WithSheet>
  )
}

/** The phone's item page: the item's bar, its page, the box replying to it, the bar above the box. */
function PhoneItem() {
  return (
    <WithSheet desk={false}>
      {(open) => (
        <div className="flex h-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col">{pageOf(SHOP.byN.get(1)!, false, { docs: [D1] })}</div>
          <div className="relative">
            {bar('phone', open)}
            <PageBox m={SHOP_BLOCKED} n={1} desk={false} />
          </div>
        </div>
      )}
    </WithSheet>
  )
}

/** The desktop with an item open: the sidebar, the bar of the project (its agent button blocked), the list, the item,
 * the box under it, the bar above the box. */
function DeskItem() {
  return (
    <WithSheet desk>
      {(open) => <DeskPage slug="shop" n={1} rail={false} onSearch={act('Sidebar: search')} model={SHOP_BLOCKED} onAgents={open} float={bar('desk', open)} />}
    </WithSheet>
  )
}

const pad = (node: ReactNode) => <div className="bg-zinc-200 p-6 dark:bg-zinc-800">{node}</div>

/** The list on the phone; on the desktop the list's page is the New input page (its own story). */
export const OnTheList: Story = {
  name: 'Phone · the list',
  render: () => pad(<Frame layout="phone" width={PHONE.width}><PhoneList /></Frame>),
}

/** An item open, its box under it: the bar just above the box, on the phone and on the desktop. */
export const OnAnItem: Story = {
  name: 'An item, above its box',
  render: () => <Frames deskWidth={1280} height={760}>{(layout) => (layout === 'desk' ? <DeskItem /> : <PhoneItem />)}</Frames>,
}

/** The phone's Inputs tab: the bar just above the box at its foot. */
export const OnNewInputPhone: Story = {
  name: 'Phone · New input',
  render: () => pad(<WithSheet desk={false}>{(open) => <NewInputPhone float={bar('phone', open)} />}</WithSheet>),
}

/** The desktop's New input page: its box is at its top, so the bar floats at the window's bottom, over what you said
 * (centred beside the sidebar, as over the page's pane). */
export const OnNewInputDesk: Story = {
  name: 'Desktop · New input',
  render: () => pad(<WithSheet desk>{(open) => <NewInputDesk height={860} float={bar('desk', open, 'fixed left-60 right-0 bottom-5 z-30 px-6')} />}</WithSheet>),
}

/** The bar alone: an agent by its app's icon (Claude Code, Codex), one without an icon by its letter; none blocked:
 * nothing. */
export const TheBar: Story = {
  name: 'The bar',
  render: () => (
    <Frames deskWidth={720} phone desk>
      {() => (
        <States
          items={[
            ['Claude Code blocked', <BlockedBar key="cc" by="claude-code" place="p-4" onOpen={act('Open: the Agents sheet')} />],
            ['Codex blocked', <BlockedBar key="cx" by="codex" place="p-4" onOpen={act('Open: the Agents sheet')} />],
            ['an agent without an icon', <BlockedBar key="ag" by="antigravity" place="p-4" onOpen={act('Open: the Agents sheet')} />],
            ['none blocked: nothing', <BlockedBar key="no" by={null} place="p-4" onOpen={act('Open: the Agents sheet')} />],
          ]}
        />
      )}
    </Frames>
  ),
}
