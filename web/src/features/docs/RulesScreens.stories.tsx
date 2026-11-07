// I693 (r1116, r1118, r1128): the Rules tab is the project's rules as one Markdown document with versions. Each screen
// on the phone and the desktop, drawn by the page's own screens (RulesScreens) with the page's DocView, DocEdit, Sheet
// and Toast; the steps of what Yadong decided drawn one story each: every save is a version (who, when, why; one
// writer's saves minutes apart are one version, every why kept); a version shows its changes marked in place (added
// green, removed struck red, one column) or against now; a restore asks once, becomes the next version, Undo takes it
// back; an agent only proposes, Yadong approves or declines on its card, the card stays in place decided; a proposal
// whose section changed since goes back to its agent.
import { useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { beforeOf, diffChunks, historyRows, ruleWho } from '../../model/rules'
import { when } from '../../model/time'
import type { RuleProposal, RuleVersion } from '../../model/types'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { acts } from '../../stories/acts'
import { docAt, envOf } from '../../stories/docPage'
import { modelOf } from '../../stories/fixtures'
import { Frames } from '../../stories/Frames'
import { HISTORY, PROPOSAL, RESTORED, rulesDocOf } from '../../stories/rulesFixtures'
import { DocEdit } from './DocEdit'
import { restoreAsk } from './Rules'
import { RulesEditing, RulesHistory, RulesProposal, RulesReading, RulesVersion, type ProposalShown, type RulesFrame } from './RulesScreens'

export default { title: 'Components/Rules/Screens', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const on = acts('Rules', ['history', 'copy', 'edit', 'view', 'comment', 'decline', 'approve', 'restore', 'cancel', 'save', 'discard', 'leave', 'back', 'pick', 'undo', 'marks', 'now', 'mic'] as const, {
  history: 'Rules › Screens › History',
  view: 'Rules › Screens › A proposal opened',
  edit: 'Rules › Screens › Editing, with why',
  restore: 'Rules › Screens › Restoring: 2 it asks once',
})
const env = (desk: boolean) => envOf(modelOf([]), desk)
const NOW = env(true).now
const frame = (desk: boolean): RulesFrame => ({ desk, place: '' })
const shown = (p: RuleProposal): ProposalShown => ({ f: { p, who: ruleWho(p.by), when: when(p.t, NOW), talk: p.comments.length }, on })
const sub = (x: RuleVersion) => `v${x.v} · ${ruleWho(x.by)} · ${when(x.t, NOW)}`

const screens = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => <Frames height={852} deskWidth={1000} phoneWidth={393}>{(layout) => <div className="flex h-full flex-col">{draw(layout === 'desk')}</div>}</Frames>,
})

function Reading({ desk, history = HISTORY, proposals = [PROPOSAL] }: { desk: boolean; history?: RuleVersion[]; proposals?: RuleProposal[] }) {
  const d = rulesDocOf(history, proposals)
  const x = history.at(-1) as RuleVersion
  return <RulesReading f={frame(desk)} sub={sub(x)} proposals={proposals.filter((p) => p.state === 'wait').map(shown)} doc={docAt(d, desk, { viewOnly: true })} on={on} />
}

/** The Rules tab opens the document: the bar says its version, who made it and when (the phone: the version);
 * History, Copy (the desktop) and Edit. An agent's proposal waits above it; its paragraphs' comments are as on any
 * document. */
export const ReadingTheRules: Story = { ...screens((desk) => <Reading desk={desk} />), name: 'Reading, a proposal waiting' }

/** No proposal waiting: the document alone, and the tab has no number. */
export const ReadingNoProposal: Story = { ...screens((desk) => <Reading desk={desk} proposals={[]} />), name: 'Reading, nothing waiting' }

/** A project with no rules yet: what they are for, and Write the rules. */
export const NoRulesYet: Story = {
  ...screens((desk) => <RulesReading f={frame(desk)} sub="" proposals={[]} doc={null} on={on} />),
  name: 'No rules yet',
}

function Editing({ desk }: { desk: boolean }) {
  const [text, setText] = useState((HISTORY.at(-1) as RuleVersion).md)
  const [why, setWhy] = useState('')
  const editor = <DocEdit isNew={false} text={text} hint={desk ? 'Esc keeps draft' : ''} mic={{ on: false, text: 'Speak' }} on={{ change: setText, discard: on.discard, save: on.save, mic: on.mic }} />
  return <RulesEditing f={frame(desk)} why={why} editor={editor} on={{ why: setWhy, leave: on.leave }} />
}

/** Edit: the whole document in the page's editor, one line under the bar for why (optional for Yadong; it becomes the
 * version's note). Save makes the next version. */
export const EditingTheRules: Story = { ...screens((desk) => <Editing desk={desk} />), name: 'Editing, with why' }

function OneVersion({ desk, v, now = false, marks = true, history = HISTORY }: { desk: boolean; v: number; now?: boolean; marks?: boolean; history?: RuleVersion[] }) {
  const d = rulesDocOf(history)
  const x = history.find((h) => h.v === v) as RuleVersion
  const latest = history.at(-1) as RuleVersion
  const chunks = marks || now ? diffChunks(now ? x.md : beforeOf(d, v), now ? latest.md : x.md) : [{ mark: '' as const, text: x.md }]
  return (
    <RulesVersion
      f={frame(desk)}
      sub={now ? `v${v} → now` : desk ? sub(x) : `v${v}`}
      v={v}
      chunks={chunks}
      marks={marks}
      now={now}
      current={v === latest.v}
      rows={historyRows(d, NOW)}
      world={env(desk).world}
      on={on}
    />
  )
}

/** History: the versions newest first by day, each with who, when, every why (a version of one writer's saves minutes
 * apart keeps both), lines added and removed, the newest "Now". The desktop shows the one picked beside the list; the
 * phone lists them on a page of their own. */
export const VersionHistory: Story = {
  ...screens((desk) => (desk ? <OneVersion desk v={7} /> : <RulesHistory f={frame(false)} rows={historyRows(rulesDocOf(), NOW)} on={on} />)),
  name: 'History',
}

/** One version (v6, Claude Code's, approved): what it changed from v5 marked in place, added on green, removed struck
 * in red; the text around a change folded into one line that opens it. Restore this version (the phone: at the foot). */
export const AVersionsChanges: Story = { ...screens((desk) => <OneVersion desk={desk} v={6} />), name: 'One version, its changes' }

/** Show changes off: the version's text as it was. */
export const AVersionWithoutMarks: Story = { ...screens((desk) => <OneVersion desk={desk} v={6} marks={false} />), name: 'One version, changes not shown' }

/** Compare with now: v4 against the document now (v7), every change since marked. */
export const CompareWithNow: Story = { ...screens((desk) => <OneVersion desk={desk} v={4} now />), name: 'A version compared with now' }

/** Restoring, step 1: an older version open, Restore. */
export const RestoreStep1: Story = { ...screens((desk) => <OneVersion desk={desk} v={4} />), name: 'Restoring: 1 a version' }

/** Restoring, step 2: it asks once; it becomes the next version, nothing is lost. */
export const RestoreAsking: Story = {
  ...screens((desk) => (
    <>
      <OneVersion desk={desk} v={4} />
      <Sheet open look={{ narrow: true }} desk={desk} onClose={on.cancel}>
        <SheetLayout {...restoreAsk(4, 8, { cancel: on.cancel, restore: on.restore })} />
      </Sheet>
    </>
  )),
  name: 'Restoring: 2 it asks once',
}

/** Restoring, step 3: the document is v4's again as v8 (Undo in the toast: Components › Rules › Restored › Restored, with Undo). */
export const Restored: Story = { ...screens((desk) => <Reading desk={desk} history={RESTORED} proposals={[]} />), name: 'Restoring: 3 restored' }

/** The history after the restore: v8 says it restored v4. */
export const RestoredHistory: Story = {
  ...screens((desk) => (desk ? <OneVersion desk v={8} history={RESTORED} /> : <RulesHistory f={frame(false)} rows={historyRows(rulesDocOf(RESTORED), NOW)} on={on} />)),
  name: 'Restoring: 4 the history',
}

function Proposal({ desk, p = PROPOSAL }: { desk: boolean; p?: RuleProposal }) {
  const d = rulesDocOf()
  return <RulesProposal f={frame(desk)} p={shown(p)} chunks={diffChunks(d.md, p.state === 'wait' ? (p.md ?? d.md) : d.md)} world={env(desk).world} onBack={on.back} />
}

/** A proposal, step 2 (step 1 is Reading): opened, what it changes against now marked as in the history; Comment (its
 * thread with the agent, who answers and may propose again), Not now, Approve. */
export const AProposalOpened: Story = { ...screens((desk) => <Proposal desk={desk} />), name: 'A proposal opened' }

/** A proposal, step 3: approved. The card stays where it was, its buttons disabled, Approved ticked; it is the next
 * version, the agent's. */
export const AProposalApproved: Story = { ...screens((desk) => <Proposal desk={desk} p={{ ...PROPOSAL, state: 'approved', decided: PROPOSAL.t }} />), name: 'A proposal approved' }

/** Not now: declined, in place; its agent is told. */
export const AProposalDeclined: Story = { ...screens((desk) => <Proposal desk={desk} p={{ ...PROPOSAL, state: 'declined', decided: PROPOSAL.t }} />), name: 'A proposal declined' }

/** A section it changes changed since it was written: it goes back to its agent to write again (Yadong only approves
 * proposals on the rules as they are). */
export const AProposalSentBack: Story = {
  ...screens((desk) => <Proposal desk={desk} p={{ ...PROPOSAL, state: 'stale', note: 'changed since: Commits', decided: PROPOSAL.t }} />),
  name: 'A proposal sent back',
}

/** Talked about: the card counts the words on its thread. */
export const AProposalTalkedAbout: Story = {
  ...screens((desk) => <Proposal desk={desk} p={{ ...PROPOSAL, comments: [{ id: 3, key: 'p90', th: 3, quote: PROPOSAL.why, text: 'Only the fast ones?', by: 'you', t: PROPOSAL.t, files: [] }] }} />),
  name: 'A proposal with a comment',
}
