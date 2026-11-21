// T779 (D134): a shared rule's own page, opened from Settings › Shared rules. Its address is its own and it is the Rules
// tab of a project's rules (read, comments, History, Copy, Edit the same), with the way back to the list and, under
// its text, who puts it in; the desktop keeps Settings' column of sections beside it. Drawn by the page's own
// SharedRuleFrame, DeskNav, RulesReading, DocView and UsedBy with the stories' shared rules.
import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { RulesReading, type RulesFrame } from '../features/docs/RulesScreens'
import { UsedBy } from '../features/docs/Include'
import { DeskNav } from '../features/settings/SettingsNav'
import { SharedRuleFrame } from './SharedRuleFrame'
import { when } from '../model/time'
import { PROJECT_TONES } from '../ui/tones'
import { acts } from '../stories/acts'
import { docAt, envOf } from '../stories/docPage'
import { modelOf } from '../stories/fixtures'
import { Frames } from '../stories/Frames'
import { SHARED_RULES, sharedDoc, sharedOf } from '../stories/sharedRulesFixtures'

export default { title: 'Pages/A shared rule’s page', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const on = acts('Shared rule', ['history', 'copy', 'edit', 'back', 'project', 'open', 'keys'] as const, { back: 'UI › Settings and help › Settings › Shared rules › The list' })
const NOW = envOf(modelOf([]), true).now
const frame = (desk: boolean): RulesFrame => ({ desk, place: '' })
const screens = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => <Frames height={852} deskWidth={1240} phoneWidth={393}>{(layout) => <div className="flex h-full flex-col">{draw(layout === 'desk')}</div>}</Frames>,
})

/** 编程 opened from Settings › Shared rules: read as the Rules tab reads a project's rules (its comments as on any
 * document; History, Copy, Edit the same), the way back to the list, and under it who puts it in, read only. The
 * desktop keeps Settings' column beside it. */
export const SharedPage: Story = {
  name: 'A shared rule’s page',
  ...screens((desk) => {
    const s = sharedOf('编程')
    const d = sharedDoc(s)
    const page = (
      <RulesReading
        f={frame(desk)}
        sub={`v${s.v} · ${when(d.t1, NOW)}`}
        proposals={[]}
        doc={docAt(d, desk, { viewOnly: true })}
        shared={{ name: s.name, empty: '', under: <UsedBy rows={s.used.map((u, i) => ({ ...u, tone: PROJECT_TONES[i % PROJECT_TONES.length] }))} on={{ open: on.project }} />, onBack: on.back }}
        on={on}
      />
    )
    const nav = desk ? <DeskNav current="shared" back="Taska" f={{ right: { shared: SHARED_RULES.length } }} on={{ open: on.open, back: on.back, keys: on.keys, href: () => '#' }} /> : null
    return (
      <SharedRuleFrame desk={desk} nav={nav}>
        {page}
      </SharedRuleFrame>
    )
  }),
}

/** New shared rules, nothing written yet: what it is for, and Write the rules. */
export const SharedEmpty: Story = {
  name: 'A shared rule’s page: nothing written yet',
  ...screens((desk) => (
    <SharedRuleFrame desk={desk} nav={desk ? <DeskNav current="shared" back="Taska" f={{ right: { shared: 4 } }} on={{ open: on.open, back: on.back, keys: on.keys, href: () => '#' }} /> : null}>
      <RulesReading f={frame(desk)} sub="" proposals={[]} doc={null} shared={{ name: '设计', empty: 'Nothing written yet. A project puts it in with {{设计}}.', under: <UsedBy rows={[]} on={{ open: on.project }} />, onBack: on.back }} on={on} />
    </SharedRuleFrame>
  )),
}
