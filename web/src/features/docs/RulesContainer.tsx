// The Rules tab with the page's data (I693): the project's rules document read (its paragraphs' comments as on any
// document, an agent's proposals waiting above it), edited whole with why, its history by day, one version with its
// changes marked, compared with now and restored, and a proposal opened, approved or declined. The screens are
// RulesScreens'; this gives them the model and what their buttons do.

import { useEffect, useState } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import type { ProjectRoute } from '../../app/hooks'
import { useProjectModel } from '../../app/hooks'
import { RecMeter } from '../../app/RecMeter'
import { beforeOf, diffChunks, historyRows, nowVersion, readRulesView, ruleWho, rulesDoc, waitingProposals, type RulesView } from '../../model/rules'
import { when } from '../../model/time'
import type { Doc, RuleProposal } from '../../model/types'
import { PLACE_LEVELS } from '../../ui/PlaceVoice'
import { useDoc } from './DocContainer'
import { DocEdit } from './DocEdit'
import { DocView } from './DocView'
import { RulesEditing, RulesHistory, RulesProposal, RulesReading, RulesVersion, type ProposalShown, type RulesFrame } from './RulesScreens'

export function RulesContainer({ route, place, hidden, footRoom = 0 }: { route: ProjectRoute; place: string; hidden?: boolean; footRoom?: number }) {
  const app = useServices('rules', 'docs')
  const stores = useStores('docView')
  const desk = useLayout() === 'desk'
  const m = useProjectModel(route.slug)
  const d = rulesDoc(m)
  const view = readRulesView(route.place.kind === 'rules' ? route.place.at : '')
  const editing = useStoreValue(stores.docView, (s) => s.editing && s.newFor == null)
  const doc = useDoc(route.slug, d?.d ?? -1)
  const [marks, setMarks] = useState(true)
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
    f: { p, who: ruleWho(p.by), when: when(p.t, now), talk: p.comments.length },
    on: {
      view: () => go({ kind: 'proposal', p: p.id }),
      comment: () => app.docs.proposalComment(p.id, p.why),
      decline: () => app.rules.decide(p.id, false),
      approve: () => app.rules.decide(p.id, true),
    },
  })
  const v = nowVersion(d)
  const sub = (x = v) => (x ? `v${x.v} · ${ruleWho(x.by)} · ${when(x.t, now)}` : '')
  const world = doc.env.world

  if (editing) return <RulesEditor d={d} f={f} />

  if (view.kind === 'read')
    return (
      <RulesReading
        f={f}
        sub={sub()}
        phoneSub={v ? `v${v.v}` : ''}
        proposals={waitingProposals(d).map(shown)}
        doc={d && d.md.trim() && doc.facts ? <DocView facts={doc.facts} env={doc.env} on={doc.on} meter={<RecMeter n={desk ? PLACE_LEVELS.desk : PLACE_LEVELS.phone} />} aim={doc.v.aim} onAimed={doc.aimed} /> : null}
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
 * with the why. */
function RulesEditor({ d, f }: { d: Doc | undefined; f: RulesFrame }) {
  const app = useServices('dictation', 'fields', 'rules')
  const stores = useStores('dictation', 'docView')
  const text = useStoreValue(stores.docView, (s) => s.text) ?? d?.md ?? ''
  const rec = useStoreValue(stores.dictation, (s) => s.rec)
  const waiting = useStoreValue(stores.dictation, (s) => s.waiting.filter((w) => w.key === `D${d?.d}`).length)
  const [why, setWhy] = useState('')
  const hint = rec ? 'Listening… words go at the mark' : waiting ? 'Transcribing…' : f.desk ? 'Esc keeps draft' : ''
  const editor = (
    <DocEdit
      isNew={!d}
      text={text}
      hint={hint}
      mic={{ on: !!rec, text: rec ? 'Stop' : 'Speak' }}
      fieldRef={app.fields.ref('doc')}
      on={{ change: (t) => stores.docView.getState().setText(t), discard: () => app.rules.discard(), save: () => void app.rules.save(why), mic: () => app.dictation.toggle() }}
    />
  )
  return <RulesEditing f={f} why={why} editor={editor} on={{ why: setWhy, leave: () => app.rules.keep() }} />
}
