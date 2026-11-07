// The Rules tab's screens (I693), each on the desktop (the pane over both columns) and the phone (the rules read in
// the tab; the rest over the whole screen): the rules read with the proposals waiting above them, the editor with its
// why line, the history, one version (its changes, or against now), a proposal opened. Props only; the document's own
// view and the editor come as slots.

import type { ReactNode } from 'react'
import type { Chunk, VersionRow } from '../../model/rules'
import type { InlineWorld } from '../../ui/markdown/inline'
import { PaneFrame } from '../../ui/PaneFrame'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { DocPaneNav } from './DocPane'
import { PHONE_DOC_LOOK } from './DocView'
import { BarBtn, ChangedText, NoRules, ProposalCard, RestoreFoot, RulesHead, RULES_COLUMN, VersionList, VersionTools, WhyField, type ProposalEvents, type ProposalFacts } from './Rules'

export interface RulesFrame {
  desk: boolean
  place: string
  hidden?: boolean
  /** the phone: the box's height, which a proposal's page stays above (its Comment is written there) */
  footRoom?: number
}

/** A page of the rules: on the desktop the pane (Back to Rules first in its bar); on the phone over the whole screen. */
function Screen({ f, head, acts, foot, split = false, box = false, onBack, children }: { f: RulesFrame; head: ReactNode; acts?: ReactNode; foot?: ReactNode; split?: boolean; box?: boolean; onBack(): void; children: ReactNode }) {
  if (f.desk)
    return (
      <PaneFrame place={f.place} hidden={f.hidden} desk split={split} lead={<DocPaneNav to="Rules" onBack={onBack} />} head={head} acts={acts} onBack={onBack}>
        {split ? children : <div className="w-full px-8 pt-8 pb-12">{children}</div>}
      </PaneFrame>
    )
  return (
    <>
      {/* the tab's room under the sheet: the box stays at the foot of the screen */}
      <div hidden={f.hidden} className="min-h-0 flex-1" />
      <Sheet open={!f.hidden} look={PHONE_DOC_LOOK} desk={false} footRoom={box ? f.footRoom : 0} onClose={onBack}>
        <SheetLayout head={head} body={children} foot={foot} />
      </Sheet>
    </>
  )
}

export interface ProposalShown {
  f: ProposalFacts
  on: ProposalEvents
}

/** The rules read: the version, who and when in the bar, History, Copy and Edit, the phone's as the desktop's; the proposals waiting above the document; none yet: what they are for and Write the rules. */
export function RulesReading({ f, sub, proposals, doc, on }: { f: RulesFrame; sub: string; proposals: ProposalShown[]; doc: ReactNode | null; on: { history(): void; copy(): void; edit(): void } }) {
  const reading = (
    <>
      {proposals.map((p) => (
        <div key={p.f.p.id} className={`mb-6 ${RULES_COLUMN}`}>
          <ProposalCard f={p.f} on={p.on} />
        </div>
      ))}
      {doc ?? <NoRules onWrite={on.edit} />}
    </>
  )
  const history = sub ? <BarBtn icon="history" label="History" onClick={on.history} /> : null
  const edit = <BarBtn icon="pencil" label="Edit" onClick={on.edit} />
  if (f.desk)
    return (
      <PaneFrame
        place={f.place}
        hidden={f.hidden}
        desk
        head={<RulesHead sub={sub} />}
        acts={
          <>
            {history}
            {sub ? <BarBtn icon="copy" label="Copy" onClick={on.copy} /> : null}
            {edit}
          </>
        }
        onBack={() => undefined}
      >
        <div className="w-full px-8 pt-8 pb-12">{reading}</div>
      </PaneFrame>
    )
  return (
    <section data-part="rules" hidden={f.hidden} className={`flex min-h-0 flex-1 flex-col ${f.place}`}>
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-zinc-100 pr-2 pl-4 dark:border-zinc-800/70">
        <span className="min-w-0 flex-1">
          <RulesHead sub={sub} />
        </span>
        {history}
        {sub ? <BarBtn icon="copy" label="Copy" onClick={on.copy} /> : null}
        {edit}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(var(--foot-h,0px)+1.5rem)]">{reading}</div>
    </section>
  )
}

/** The whole document in the page's editor, and one line under the bar for why (optional for you, r1128 #7). */
export function RulesEditing({ f, why, editor, on }: { f: RulesFrame; why: string; editor: ReactNode; on: { why(v: string): void; leave(): void } }) {
  if (f.desk)
    return (
      <PaneFrame place={f.place} hidden={f.hidden} desk split head={<RulesHead sub="Editing" />} onBack={on.leave}>
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-[46rem] shrink-0 px-4">
            <WhyField value={why} onChange={on.why} />
          </div>
          <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col px-8 pt-4 pb-12">{editor}</div>
        </div>
      </PaneFrame>
    )
  return (
    <Sheet open={!f.hidden} look={PHONE_DOC_LOOK} desk={false} onClose={on.leave}>
      <SheetLayout
        head={<RulesHead sub="Editing" />}
        body={
          <>
            <div className="-mx-4 -mt-2 mb-2">
              <WhyField value={why} onChange={on.why} />
            </div>
            {editor}
          </>
        }
      />
    </Sheet>
  )
}

/** The phone's history, a page of its own (a row opens that version). */
export function RulesHistory({ f, rows, on }: { f: RulesFrame; rows: readonly VersionRow[]; on: { pick(v: number): void; back(): void } }) {
  return (
    <Screen f={f} head="History" onBack={on.back}>
      <div className="-mx-4">
        <VersionList rows={rows} picked={null} on={{ pick: on.pick }} />
      </div>
    </Screen>
  )
}

/** One version: the document as it was, what it changed marked in place (or against now; or the marks off), its tools,
 * Restore (the phone: at the foot); the desktop lists the versions beside it (Nota's history). */
export function RulesVersion({ f, sub, v, chunks, marks, now, current, rows, world, on }: {
  f: RulesFrame
  sub: string
  v: number
  chunks: readonly Chunk[]
  marks: boolean
  now: boolean
  current: boolean
  rows: readonly VersionRow[]
  world: InlineWorld
  on: { marks(): void; now(): void; restore(): void; pick(v: number): void; back(): void }
}) {
  const text = <ChangedText key={`${v}${now}${marks}`} chunks={chunks} world={world} />
  const tools = <VersionTools marks={marks} now={now} current={current} desk={f.desk} on={on} />
  const head = <RulesHead sub={sub} />
  if (f.desk)
    return (
      <Screen f={f} head={head} acts={tools} split onBack={on.back}>
        <div className="flex h-full">
          <div className="min-w-0 flex-1 overflow-y-auto px-8 pt-8 pb-12">{text}</div>
          <div className="w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <VersionList rows={rows} picked={v} on={{ pick: on.pick }} />
          </div>
        </div>
      </Screen>
    )
  return (
    <Screen f={f} head={head} onBack={on.back} foot={current ? null : <RestoreFoot v={v} onRestore={on.restore} />}>
      <div className="-mx-4 -mt-2 mb-4 flex gap-1 overflow-x-auto border-b border-zinc-100 px-2 py-1 dark:border-zinc-800/70">{tools}</div>
      {text}
    </Screen>
  )
}

/** A proposal opened: its card (Comment, Not now, Approve; decided, in place), what it changes against now marked. */
export function RulesProposal({ f, p, chunks, world, onBack }: { f: RulesFrame; p: ProposalShown; chunks: readonly Chunk[]; world: InlineWorld; onBack(): void }) {
  return (
    <Screen f={f} head={<RulesHead sub={`Proposal on v${p.f.p.on}`} />} box onBack={onBack}>
      <div className={`mb-6 ${RULES_COLUMN}`}>
        <ProposalCard f={p.f} open on={p.on} />
      </div>
      <ChangedText key={p.f.p.id} chunks={chunks} world={world} />
    </Screen>
  )
}
