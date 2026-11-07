// I693 (r1128): a restore is the next version, and Undo in the toast takes it back. The page's Rules screen with the
// page's toast over it, as after Restore v4.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ruleWho } from '../model/rules'
import { when } from '../model/time'
import type { RuleVersion } from '../model/types'
import { RulesReading } from '../features/docs/RulesScreens'
import { Toast } from '../features/feedback/Toast'
import { acts } from './acts'
import { docAt, envOf } from './docPage'
import { modelOf } from './fixtures'
import { Frames } from './Frames'
import { RESTORED, rulesDocOf } from './rulesFixtures'

export default { title: 'Components/Rules/Restored', parameters: { layout: 'fullscreen' } } satisfies Meta

const on = acts('Rules', ['history', 'copy', 'edit', 'undo', 'close'] as const)

/** v8 is v4's text again; "Restored v4", Undo. */
export const RestoredWithUndo: StoryObj = {
  name: 'Restored, with Undo',
  render: () => (
    <Frames height={852} deskWidth={1000} phoneWidth={393}>
      {(layout) => {
        const desk = layout === 'desk'
        const x = RESTORED.at(-1) as RuleVersion
        return (
          <div className="flex h-full flex-col">
            <RulesReading f={{ desk, place: '' }} sub={`v${x.v} · ${ruleWho(x.by)} · ${when(x.t, envOf(modelOf([]), desk).now)}`} proposals={[]} doc={docAt(rulesDocOf(RESTORED, []), desk, { viewOnly: true })} on={on} />
            <Toast toast={{ text: 'Restored v4', error: false, sticky: true, action: { label: 'Undo' } }} place="bottom-6 left-1/2 w-max -translate-x-1/2" onAction={on.undo} onClose={on.close} />
          </div>
        )
      }}
    </Frames>
  ),
}
