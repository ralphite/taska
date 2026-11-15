// The Rules tab with the page's data (I693): the project's rules document read (its paragraphs' comments as on any
// document, an agent's proposals waiting above it), edited whole with why, its history by day, one version with its
// changes marked, compared with now and restored, and a proposal opened, approved or declined. Its lines `{{name}}`
// read as the shared rules they put in, opened in place; the editor inserts one (I779). A shared rule's own page is
// this too, with its name, the way back and the projects that use it. The screens are RulesScreens'; this gives them
// the model and what their buttons do.

import { useEffect, useState } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import type { ProjectRoute } from '../../app/hooks'
import { useProjectModel } from '../../app/hooks'
import { RecMeter } from '../../app/RecMeter'
import { useSideProjects } from '../../app/projectLists'
import { isSharedSlug, notFound, ruleOf } from '../../model/includes'
import { beforeOf, diffChunks, historyRows, nowVersion, readRulesView, ruleWho, rulesDoc, waitingProposals, type RulesView } from '../../model/rules'
import { when } from '../../model/time'
import type { Doc, RuleProposal, SharedRule } from '../../model/types'
import { toneOf } from '../../ui/tones'
import { PLACE_LEVELS } from '../../ui/PlaceVoice'
import { Who } from '../../ui/bits'
import { useDoc } from './DocContainer'
import { DocEdit } from './DocEdit'
import { DocView } from './DocView'
import { includeRuns, NotFoundHint, SharedButton, UsedBy } from './Include'
import { RulesEditing, RulesHistory, RulesProposal, RulesReading, RulesVersion, type ProposalShown, type RulesFrame, type SharedPage } from './RulesScreens'

export function RulesContainer({ route, place, hidden, footRoom = 0 }: { route: ProjectRoute; place: string; hidden?: boolean; footRoom?: number }) {
  const app = useServices('rules', 'docs', 'nav', 'sharedRules')
  const stores = useStores('docView', 'settings')
  const desk = useLayout() === 'desk'
  const m = useProjectModel(route.slug)
  const d = rulesDoc(m)
  const view = readRulesView(route.place.kind === 'rules' ? route.place.at : '')
  const editing = useStoreValue(stores.docView, (s) => s.editing && s.newFor == null)
  const doc = useDoc(route.slug, d?.d ?? -1)
  const [marks, setMarks] = useState(true)
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const shared = useStoreValue(stores.settings, (s) => s.shared)
  const { tones, icons } = useSideProjects(route.slug)
  const own = isSharedSlug(route.slug) ? ruleOf(shared ?? [], m?.facts.title ?? '') : undefined
  useEffect(() => {
    // the shared rules its lines put in (and, a shared rule's page, who uses it): asked each time it shows
    void app.sharedRules.load()
  }, [app, route.slug])
  const dn = d?.d
  useEffect(() => {
    // the rules are the document a comment goes to (the model may come after the address)
    if (dn != null) stores.docView.getState().show(dn)
  }, [stores, dn])
  if (!m) return null
  const f: RulesFrame = { desk, place, hidden, footRoom }
  const now = m.at
  const go = (v: RulesView, push = true) => app.rules.go(v, push)
  const back = () => go(view.kind === 'version' && !desk ? { kind: 'history' } : { kind: 'read' }, false)
  const shown = (p: RuleProposal): ProposalShown => ({
    f: { p, who: ruleWho(p.by), now, talk: p.comments.length },
    on: {
      view: () => go({ kind: 'proposal', p: p.id }),
      comment: () => app.docs.proposalComment(p.id, p.why),
      decline: () => app.rules.decide(p.id, false),
      approve: () => app.rules.decide(p.id, true),
    },
  })
  const v = nowVersion(d)
  // who by its app's icon where it has one (T711)
  const sub = (x = v) => (x ? <>v{x.v} · <Who by={x.by} /> · {when(x.t, now)}</> : '')
  const world = doc.env.world

  if (editing) return <RulesEditor d={d} f={f} shared={shared} insertable={!isSharedSlug(route.slug)} />
  const toggle = (label: string) => {
    const next = new Set(opened)
    if (!next.delete(label)) next.add(label)
    setOpened(next)
  }
  const lines = (text: string) => includeRuns(text, shared, world, opened, { toggle, open: (slug) => app.sharedRules.open(slug) })
  const sharedPage: SharedPage | undefined = isSharedSlug(route.slug)
    ? {
        name: m.facts.title,
        empty: `Nothing written yet. A project puts it in with {{${m.facts.title}}}.`,
        under: <UsedBy rows={(own?.used ?? []).map((u) => ({ ...u, tone: toneOf(tones, u.project), icon: icons.get(u.project) }))} on={{ open: (p) => app.nav.to(`/p/${encodeURIComponent(p)}/rules`) }} />,
        onBack: () => app.sharedRules.back(),
      }
    : undefined

  if (view.kind === 'read')
    return (
      <RulesReading
        f={f}
        sub={sub()}
        proposals={waitingProposals(d).map(shown)}
        doc={d && d.md.trim() && doc.facts ? <DocView facts={doc.facts} env={doc.env} on={doc.on} meter={<RecMeter n={desk ? PLACE_LEVELS.desk : PLACE_LEVELS.phone} />} aim={doc.v.aim} onAimed={doc.aimed} lines={lines} /> : null}
        shared={sharedPage}
        on={{ history: () => go({ kind: 'history' }), copy: () => app.rules.copy(), edit: () => app.rules.edit() }}
      />
    )

  if (view.kind === 'proposal') {
    const p = d?.proposals?.find((x) => x.id === view.p)
    if (!p) return null
    return <RulesProposal f={f} p={shown(p)} chunks={diffChunks(d?.md ?? '', p.state === 'wait' ? (p.md ?? d?.md ?? '') : (d?.md ?? ''))} world={world} onBack={back} />
  }

  // the history (the desktop: the version now beside the list), one version, a version against now
  const rows = historyRows(d, now)
  if (!desk && view.kind === 'history') return <RulesHistory f={f} rows={rows} on={{ pick: (n) => go({ kind: 'version', v: n, now: false }), back }} />
  const x = d?.history?.find((h) => h.v === (view.kind === 'version' ? view.v : v?.v))
  if (!x) return null
  const vsNow = view.kind === 'version' && view.now
  const chunks = marks || vsNow ? diffChunks(vsNow ? x.md : beforeOf(d, x.v), vsNow ? (d?.md ?? '') : x.md) : [{ mark: '' as const, text: x.md }]
  return (
    <RulesVersion
      f={f}
      sub={vsNow ? `v${x.v} → now` : desk ? sub(x) : `v${x.v}`}
      v={x.v}
      chunks={chunks}
      marks={marks}
      now={vsNow}
      current={x.v === v?.v}
      rows={rows}
      world={world}
      on={{ marks: () => setMarks(!marks), now: () => go({ kind: 'version', v: x.v, now: !vsNow }, false), restore: () => app.rules.ask(x.v), pick: (n) => go({ kind: 'version', v: n, now: false }, false), back }}
    />
  )
}

/** The editor with the page's data: the text being edited (the rules' own until you change it), Speak, Discard, Save
 * with the why; a project's rules also Insert shared rules, and say a line whose name is not found (I779). */
function RulesEditor({ d, f, shared, insertable }: { d: Doc | undefined; f: RulesFrame; shared: readonly SharedRule[] | null; insertable: boolean }) {
  const app = useServices('dictation', 'fields', 'rules', 'sheets')
  const stores = useStores('dictation', 'docView')
  const text = useStoreValue(stores.docView, (s) => s.text) ?? d?.md ?? ''
  const rec = useStoreValue(stores.dictation, (s) => s.rec)
  const waiting = useStoreValue(stores.dictation, (s) => s.waiting.filter((w) => w.key === `D${d?.d}`).length)
  const [why, setWhy] = useState('')
  const said = rec ? 'Listening… words go at the mark' : waiting ? 'Transcribing…' : f.desk ? 'Esc keeps draft' : ''
  const hint = <NotFoundHint labels={insertable ? notFound(text, shared) : []} hint={said} />
  const insert = { kind: 'shared-insert' } as const
  const editor = (
    <DocEdit
      isNew={!d}
      text={text}
      hint={hint}
      mic={{ on: !!rec, text: rec ? 'Stop' : 'Speak' }}
      tools={insertable ? <SharedButton onClick={(e) => (f.desk ? app.sheets.openFrom(e.currentTarget, insert, { focus: false }) : app.sheets.open(insert, { focus: false }))} /> : null}
      fieldRef={app.fields.ref('doc')}
      on={{ change: (t) => stores.docView.getState().setText(t), discard: () => app.rules.discard(), save: () => void app.rules.save(why), mic: () => app.dictation.toggle() }}
    />
  )
  return <RulesEditing f={f} why={why} editor={editor} on={{ why: setWhy, leave: () => app.rules.keep() }} />
}
