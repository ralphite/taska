import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { Frames, States } from '../../stories/Frames'
import { PROJECT_TONES } from '../../ui/tones'
import { AgentPill, ListHead, PhoneTabs, ProjectBar, type TabInfo } from './Header'

const meta: Meta = { title: 'Components/Project head' }
export default meta
type Story = StoryObj

const tabs = (phone: boolean): TabInfo[] =>
  (phone ? (['items', 'inputs', 'rules'] as const) : (['items', 'rules'] as const)).map((t, i) => ({ tab: t, count: [32, 4, 51][i], selected: i === 0 }))
const headOn = { menu() {}, agents() {}, notSaved() {}, search() {}, query() {}, clear() {}, firstResult() {}, filters() {} }
const agent = { tone: 'bad' as const, label: 'No agent · 2h', offline: false }

/** Whether an agent is around, in each of its looks. */
export const Agent: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['ready', <div className="p-2"><AgentPill tone="ready" label="Claude Code ready" offline={false} /></div>],
            ['here lately', <div className="p-2"><AgentPill tone="recent" label="Codex · 4m" offline={false} /></div>],
            ['nothing waits for it', <div className="p-2"><AgentPill tone="idle" label="Claude Code · 3h" offline={false} /></div>],
            ['work waits, no agent', <div className="p-2"><AgentPill tone="bad" label="No agent · 2h" offline={false} /></div>],
            ['Taska is away', <div className="p-2"><AgentPill tone="bad" label="No agent" offline /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}

/** The project's bar on the desktop, the list's head, the phone's head and tabs. */
export const Heads: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={1024}>
      {(layout) => {
        const phone = layout === 'phone'
        return (
          <States
            items={[
              ...(phone
                ? []
                : ([['the project’s bar', <ProjectBar title="taska" tone={PROJECT_TONES[4]} tabs={tabs(false)} agent={agent} notSaved={0} place="" on={{ tab() {}, agents() {}, notSaved() {} }} />],
                    ['with changes not saved', <ProjectBar title="taska" tone={PROJECT_TONES[4]} tabs={tabs(false)} agent={agent} notSaved={2} place="" on={{ tab() {}, agents() {}, notSaved() {} }} />]] as [string, ReactElement][])),
              ['the list’s head', <ListHead phone={phone} title="taska" otherNeeds searching={false} q="" placeholder={phone ? 'Search title, text or code' : 'Search items'} agent={agent} notSaved={0} filtersSet={false} filtersOpen={false} place="" on={headOn} />],
              ['searching, filters set', <ListHead phone={phone} title="taska" otherNeeds={false} searching q="export" placeholder="Search items" agent={agent} notSaved={0} filtersSet filtersOpen={false} place="" on={headOn} />],
              ...(phone ? ([['the tabs', <PhoneTabs tabs={tabs(true)} filtersSet={false} showFilter on={{ tab() {}, filters() {} }} />]] as [string, ReactElement][]) : []),
            ]}
          />
        )
      }}
    </Frames>
  ),
}
