// I693 (r1116): a prototype of a project's rules as one Markdown document with versions, to decide on before anything
// is built. The plan, with every function kept, changed or removed and the questions for Yadong, is
// prototype/i693-plan.md; the look is Gemini's (prototype/i693-gemini-mock.html). Each screen on the phone and the
// desktop: reading, editing, the versions, one version's changes, comparing with now, restoring, an agent's proposal
// waiting and decided. The page's own parts draw what Taska has (PaneFrame, Sheet, DocView with its comments,
// DocEdit, Rich, Avatar, Toast); RulesParts draws what is new. Nothing here changes Taska itself.
import { useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DocEdit } from '../features/docs/DocEdit'
import { DocPaneNav } from '../features/docs/DocPane'
import { PHONE_DOC_LOOK } from '../features/docs/DocView'
import { Toast } from '../features/feedback/Toast'
import type { Doc } from '../model/types'
import { Icon } from '../ui/Icon'
import { PaneFrame } from '../ui/PaneFrame'
import { Sheet, SheetLayout } from '../ui/Sheet'
import { MUTED, PRIMARY, SECOND } from '../ui/tones'
import { acts } from './acts'
import { comment, doc } from './docFixtures'
import { docAt, envOf } from './docPage'
import { modelOf } from './fixtures'
import { Frames } from './Frames'
import { BarBtn, COLUMN, ChangedText, ProposalCard, RulesHead, VersionList, VersionTools, WhyField } from './i693/RulesParts'
import { PROPOSAL, RESTORED, VERSIONS, at, type Proposal, type Version } from './i693/rulesData'

export default { title: 'Prototype/I693 Project rules as one document', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const on = acts('Rules', ['back', 'history', 'edit', 'copy', 'more', 'view', 'comment', 'notNow', 'approve', 'restore', 'cancel', 'save', 'discard', 'undo'] as const)
const NOW = VERSIONS[0]
const byV = (vs: Version[], v: number) => vs.find((x) => x.v === v) ?? vs[0]
const before = (vs: Version[], v: number) => vs[vs.findIndex((x) => x.v === v) + 1]?.md ?? ''
const world = (desk: boolean) => envOf(modelOf([]), desk).world

/** The rules document as DocView reads it: its blocks, a thread on one of them. */
function rulesDoc(md: string): Doc {
  const blocks: Doc['blocks'] = md.split(/\n{2,}/).map((text, i) => ({ key: 'b' + i, kind: /^#/.test(text) ? 'heading' : /^- /.test(text) ? 'list' : 'para', text, comments: [] }))
  const agents = blocks.findIndex((b) => b.text.includes('once per session'))
  if (agents >= 0)
    blocks[agents].comments = [
      comment({ id: 1, key: blocks[agents].key, th: 1, quote: 'once per session', text: 'Codex too?', by: 'you', t: at(100) }),
      comment({ id: 2, key: blocks[agents].key, th: 1, quote: 'once per session', text: 'Yes: every agent reads it.', t: at(95) }),
    ]
  return doc({ d: 1, n: 1, title: 'Project rules', md, blocks, detached: [], whole: [], resolved: {}, t1: at(NOW.ago), by: NOW.by })
}

/** A screen on the desktop (the pane, its bar) or the phone (a sheet over the whole screen, its head). */
function Screen({ desk, head, acts: deskActs, extra, lead, foot, split = false, children }: { desk: boolean; head: ReactNode; acts?: ReactNode; extra?: ReactNode; lead?: ReactNode; foot?: ReactNode; split?: boolean; children: ReactNode }) {
  if (desk)
    return (
      <div className="flex h-full flex-col">
        <PaneFrame place="" desk head={head} acts={deskActs} lead={lead} split={split} onBack={on.back}>
          {split ? children : <div className="w-full px-8 pt-8 pb-12">{children}</div>}
        </PaneFrame>
      </div>
    )
  return (
    <Sheet open look={PHONE_DOC_LOOK} desk={false} onClose={on.back}>
      <SheetLayout head={head} extra={extra} body={children} foot={foot} />
    </Sheet>
  )
}

const screens = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => <Frames height={852} deskWidth={1000} phoneWidth={393}>{(layout) => draw(layout === 'desk')}</Frames>,
})

const readActs = (
  <>
    <BarBtn icon="history" label="History" onClick={on.history} />
    <BarBtn icon="copy" label="Copy" onClick={on.copy} />
    <BarBtn icon="pencil" label="Edit" onClick={on.edit} />
  </>
)
const readExtra = (
  <>
    <BarBtn icon="history" label="History" onClick={on.history} />
    <BarBtn icon="pencil" label="Edit" onClick={on.edit} />
  </>
)

/** The document read, the proposal waiting above it (none: `p` null). */
function Reading({ desk, v = NOW, p = PROPOSAL, toast }: { desk: boolean; v?: Version; p?: Proposal | null; toast?: string }) {
  return (
    <>
      <Screen desk={desk} head={<RulesHead v={v} label={desk ? undefined : `v${v.v}`} />} acts={readActs} extra={readExtra}>
        {p ? (
          <div className={`mb-6 ${COLUMN}`}>
            <ProposalCard p={p} desk={desk} on={on} />
          </div>
        ) : null}
        {/* the document's own line (on F001 · who · when) is left out: the bar says the version */}
        <div className="[&_span.basis-full.truncate]:hidden">{docAt(rulesDoc(v.md), desk, { viewOnly: true })}</div>
      </Screen>
      {toast ? <Toast toast={{ text: toast, error: false, sticky: true, action: { label: 'Undo' } }} place="bottom-6 left-1/2 w-max -translate-x-1/2" onAction={on.undo} onClose={on.back} /> : null}
    </>
  )
}

/** Reading: the document as Markdown, its paragraphs' comments as on any document; an agent's proposal waits above it
 * (the phone: History and Edit by the close button). The bar says the version, who made it and when. */
export const ReadingTheRules: Story = { ...screens((desk) => <Reading desk={desk} />), name: 'Reading, a proposal waiting' }

function Editing({ desk }: { desk: boolean }) {
  const [text, setText] = useState(NOW.md)
  const [why, setWhy] = useState('')
  const edit = <DocEdit isNew={false} text={text} hint="" mic={{ on: false, text: 'Speak' }} on={{ change: setText, discard: on.discard, save: on.save, mic: on.save }} />
  return (
    <Screen desk={desk} head={<RulesHead v={NOW} label="Editing" />} split={desk}>
      {desk ? (
        <div className="flex h-full flex-col">
          <WhyField value={why} onChange={setWhy} />
          <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col px-8 pt-4 pb-12">{edit}</div>
        </div>
      ) : (
        <>
          <div className="-mx-4 -mt-2 mb-2">
            <WhyField value={why} onChange={setWhy} />
          </div>
          {edit}
        </>
      )}
    </Screen>
  )
}

/** Editing: the whole document as today's editor, and one line under the bar for why (it becomes the version's
 * note; optional for Yadong). */
export const EditingTheRules: Story = { ...screens((desk) => <Editing desk={desk} />), name: 'Editing, with why' }

/** One version: the document as it was then, what it changed marked (or the marks off), or compared with now. */
function OneVersion({ desk, vs = VERSIONS, v, now = false, list = desk }: { desk: boolean; vs?: Version[]; v: number; now?: boolean; list?: boolean }) {
  const [marks, setMarks] = useState(true)
  const x = byV(vs, v)
  const text = <ChangedText before={now ? x.md : before(vs, v)} after={now ? vs[0].md : x.md} marks={marks} world={world(desk)} />
  const current = x.v === vs[0].v
  const tools = <VersionTools marks={marks} now={now} current={current} desk={desk} on={{ marks: () => setMarks(!marks), now: on.view, restore: on.restore }} />
  const label = now ? `v${x.v} → now` : desk ? undefined : `v${x.v}`
  return (
    <Screen
      desk={desk}
      split={desk}
      lead={<DocPaneNav to="Rules" onBack={on.back} />}
      head={<RulesHead v={x} label={label} />}
      acts={tools}
      foot={
        desk || current ? null : (
          <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
            <button onClick={on.restore} className={`${PRIMARY} w-full`}>
              <Icon n="undo" c="size-4" />
              Restore v{x.v}
            </button>
          </div>
        )
      }
    >
      {desk ? (
        <div className="flex h-full">
          <div className="min-w-0 flex-1 overflow-y-auto px-8 pt-8 pb-12">{text}</div>
          {list ? (
            <div className="w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <VersionList versions={vs} picked={x.v} on={{ pick: on.view }} />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="-mx-4 -mt-2 mb-4 flex gap-1 border-b border-zinc-100 px-2 py-1 dark:border-zinc-800/70">{tools}</div>
          {text}
        </>
      )}
    </Screen>
  )
}

/** The phone's list of versions, a page of its own (a row opens that version). */
function History({ desk }: { desk: boolean }) {
  if (desk) return <OneVersion desk v={NOW.v} />
  return (
    <Screen desk={false} head="History">
      <div className="-mx-4">
        <VersionList versions={VERSIONS} picked={null} on={{ pick: on.view }} />
      </div>
    </Screen>
  )
}

/** The versions, newest first by day: who, when, why, lines added and removed, the newest "Now". The desktop shows
 * the one picked beside the list (Nota's history); the phone lists them on a page of their own. */
export const VersionHistory: Story = { ...screens((desk) => <History desk={desk} />), name: 'Version history' }

/** One version (v7, Claude Code's, approved): the document as it was, what v7 changed from v6 marked in place, added
 * on green, removed struck in red. Show changes turns the marks off; Restore this version (the phone: at the foot). */
export const AVersionsChanges: Story = { ...screens((desk) => <OneVersion desk={desk} v={7} />), name: 'One version, its changes' }

/** Compare with now: v5 against the document now (v8), every change since marked. */
export const CompareWithNow: Story = { ...screens((desk) => <OneVersion desk={desk} v={5} now />), name: 'A version compared with now' }

/** Restore v5 asks once: it becomes v9, nothing is lost. */
export const RestoreAsking: Story = {
  ...screens((desk) => (
    <>
      <OneVersion desk={desk} v={5} />
      <Sheet open look={{ narrow: true }} desk={desk} onClose={on.cancel}>
        <SheetLayout
          title="Restore v5?"
          body={<p className={`text-sm ${MUTED}`}>It becomes v9. Nothing is lost.</p>}
          foot={
            <div className="flex justify-end gap-2 px-4 pt-1 pb-4">
              <button onClick={on.cancel} className={SECOND}>
                Cancel
              </button>
              <button onClick={on.restore} className={PRIMARY}>
                Restore v5
              </button>
            </div>
          }
        />
      </Sheet>
    </>
  )),
  name: 'Restoring: it asks once',
}

/** Restored: the document is v5's again as v9, "Restored v5" first in the history, Undo in the toast. */
export const Restored: Story = { ...screens((desk) => <Reading desk={desk} v={RESTORED[0]} p={null} toast="Restored v5" />), name: 'Restored, with Undo' }

/** The proposal opened: what it changes against now marked as in the history, Approve, Not now, Comment (a thread
 * with the agent, which may propose again). */
function ProposalOpen({ desk, p = PROPOSAL }: { desk: boolean; p?: Proposal }) {
  return (
    <Screen desk={desk} lead={<DocPaneNav to="Rules" onBack={on.back} />} head={<RulesHead v={NOW} label={`Proposal on v${p.on}`} />}>
      <div className={`mb-6 ${COLUMN}`}>
        <ProposalCard p={p} open desk={desk} on={on} />
      </div>
      <ChangedText before={NOW.md} after={p.md} world={world(desk)} />
    </Screen>
  )
}

export const AProposalOpened: Story = { ...screens((desk) => <ProposalOpen desk={desk} />), name: 'A proposal opened' }

/** Approved: the card stays where it was, faded, its buttons disabled, Approved ticked; the text is the new version. */
export const AProposalApproved: Story = { ...screens((desk) => <ProposalOpen desk={desk} p={{ ...PROPOSAL, decided: 'Approve' }} />), name: 'A proposal approved' }
