// The rules' parts alone (I693), each state side by side: the bar's name, an agent's proposal (waiting, opened,
// approved, declined, sent back), the text with a version's changes marked and the unchanged runs folded, the versions
// by day, the why line, a version's tools, the phone's Restore, the question a restore asks, no rules yet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { diffChunks, historyRows, ruleWho } from '../../model/rules'
import { when } from '../../model/time'
import type { RuleProposal } from '../../model/types'
import { SheetLayout, Sheet } from '../../ui/Sheet'
import { acts } from '../../stories/acts'
import { envOf } from '../../stories/docPage'
import { modelOf } from '../../stories/fixtures'
import { Frames } from '../../stories/Frames'
import { HISTORY, PROPOSAL, rulesDocOf } from '../../stories/rulesFixtures'
import { BarBtn, ChangedText, NoRules, ProposalCard, restoreAsk, RestoreFoot, RulesHead, VersionList, VersionTools, WhyField } from './Rules'

export default { title: 'Components/Rules/Parts' } satisfies Meta
type Story = StoryObj

const on = acts('Rules', ['view', 'comment', 'decline', 'approve', 'pick', 'marks', 'now', 'restore', 'cancel', 'why', 'write', 'history'] as const)
const env = envOf(modelOf([]), true)
const f = (p: RuleProposal) => ({ p, who: ruleWho(p.by), when: when(p.t, env.now), talk: p.comments.length })
const rows = (items: [string, React.ReactNode][]) => (
  <div className="flex flex-col gap-4 p-4">
    {items.map(([label, node]) => (
      <div key={label}>
        <div className="pb-1 text-xs text-zinc-500">{label}</div>
        {node}
      </div>
    ))}
  </div>
)

/** The bar's name: the version, who, when; Editing; a proposal's; and a bar's buttons. */
export const Head: Story = {
  render: () => (
    <Frames deskWidth={700} phoneWidth={393}>
      {() =>
        rows([
          ['reading', <RulesHead sub="v7 · You · 12:30" />],
          ['editing', <RulesHead sub="Editing" />],
          ['a proposal', <RulesHead sub="Proposal on v7" />],
          ['its buttons', <div className="flex gap-1"><BarBtn icon="history" label="History" onClick={on.history} /><BarBtn icon="pencil" label="Edit" onClick={on.history} /></div>],
        ])
      }
    </Frames>
  ),
  name: 'The bar',
}

/** An agent's proposal: waiting (View changes; the phone: View), opened (Comment, Not now, Approve), and decided in
 * place: Approved or Not now ticked, everything disabled (r1003); sent back when its section changed since. */
export const Proposals: Story = {
  render: () => (
    <Frames deskWidth={760} phoneWidth={393}>
      {(layout) =>
        rows([
          ['waiting', <ProposalCard f={f(PROPOSAL)} desk={layout === 'desk'} on={on} />],
          ['opened', <ProposalCard f={f(PROPOSAL)} open desk={layout === 'desk'} on={on} />],
          ['approved', <ProposalCard f={f({ ...PROPOSAL, state: 'approved' })} open desk={layout === 'desk'} on={on} />],
          ['declined', <ProposalCard f={f({ ...PROPOSAL, state: 'declined' })} open desk={layout === 'desk'} on={on} />],
          ['sent back', <ProposalCard f={f({ ...PROPOSAL, state: 'stale', note: 'changed since: Commits' })} open desk={layout === 'desk'} on={on} />],
        ])
      }
    </Frames>
  ),
  name: 'A proposal',
}

/** A version's changes: added on green, removed struck in red; the text between changes folded into one line. */
export const Changes: Story = {
  render: () => (
    <Frames deskWidth={760} phoneWidth={393}>
      {() => (
        <div className="p-4">
          <ChangedText chunks={diffChunks(HISTORY[4].md, HISTORY[5].md)} world={env.world} />
        </div>
      )}
    </Frames>
  ),
  name: 'Changes marked',
}

/** The versions by day; the one shown picked, the newest Now; a version of two saves keeps both whys. */
export const Versions: Story = {
  render: () => (
    <Frames deskWidth={320} phoneWidth={393}>
      {() => <VersionList rows={historyRows(rulesDocOf(), env.now)} picked={6} on={on} />}
    </Frames>
  ),
  name: 'The versions',
}

/** The editor's why line, a version's tools (the desktop's Restore in them; the phone's at the foot), and the current
 * version's (no Compare, Restore disabled). */
export const Tools: Story = {
  render: () => (
    <Frames deskWidth={760} phoneWidth={393}>
      {(layout) =>
        rows([
          ['why', <WhyField value="" onChange={on.why} />],
          ['why, written', <WhyField value="Commits in the imperative" onChange={on.why} />],
          ['an older version', <div className="flex gap-1"><VersionTools marks now={false} current={false} desk={layout === 'desk'} on={on} /></div>],
          ['compared with now', <div className="flex gap-1"><VersionTools marks now current={false} desk={layout === 'desk'} on={on} /></div>],
          ['the version now', <div className="flex gap-1"><VersionTools marks={false} now={false} current desk={layout === 'desk'} on={on} /></div>],
          ['the phone: Restore', <RestoreFoot v={4} onRestore={on.restore} />],
        ])
      }
    </Frames>
  ),
  name: 'Why, a version’s tools',
}

/** A restore asks once. */
export const RestoreAsk: Story = {
  render: () => (
    <Frames deskWidth={760} phoneWidth={393} height={400}>
      {(layout) => (
        <Sheet open look={{ narrow: true }} desk={layout === 'desk'} onClose={on.cancel}>
          <SheetLayout {...restoreAsk(4, 8, { cancel: on.cancel, restore: on.restore })} />
        </Sheet>
      )}
    </Frames>
  ),
  name: 'Restore asks once',
}

/** No rules yet. */
export const None: Story = { render: () => <Frames deskWidth={600} phoneWidth={393}>{() => <NoRules onWrite={on.write} />}</Frames>, name: 'No rules yet' }
