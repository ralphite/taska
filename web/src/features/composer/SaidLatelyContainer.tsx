// The desktop's New input page under the box, with the page's data: what you said lately (searched, a page more at
// a time, each opened in full when asked), what is on its way, and the draft at the top of it while a voice note's
// words are there to check; more being said into one of them on its own line (F657), and on its way there.

import { useMemo, useState, type ReactNode } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { draftTarget, NEW_DRAFT } from '../../model/draftTarget'
import { clock } from '../../model/time'
import { useAway, useFiles, useProjectModel, type ProjectRoute } from '../../app/hooks'
import type { DraftKey } from '../../model/draftTarget'
import { fixRange, voiceStretches } from '../../model/doubts'
import { codeOf } from '../../model/project'
import { saidOutgoing, saidRows } from '../../model/saidLately'
import { showsOnItsWay } from '../../model/outgoing'
import { Thumbs } from '../../ui/Files'
import { DraftWords, type Fixing } from './Doubts'
import { DraftCard, DRAFT_WORDS, type DraftHint } from './DraftCard'
import { SaidLately } from './SaidLately'
import { useHeard } from './heard'

const STEP = 30
const EMPTY: Record<string, string> = {}

/** What the list shows: its search, how many rows, which are opened in full, More and Less (kept while the page shows
 * other places). */
export function useSaidView() {
  const [q, setQ] = useState('')
  const [upTo, setUpTo] = useState(STEP)
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) => setOpened((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)))
  return { q, upTo, opened, query: (v: string) => (setQ(v), setUpTo(STEP)), more: () => setUpTo((u) => u + STEP), toggle }
}
export type SaidView = ReturnType<typeof useSaidView>

export function SaidLatelyContainer({ route, boxKey, view, draft }: { route: ProjectRoute; boxKey: DraftKey; view: SaidView; draft: ReactNode }) {
  const app = useServices('box', 'fields', 'inputActions', 'inputs', 'nav', 'sheets', 'voice')
  const stores = useStores('box', 'recording', 'data', 'drafts', 'outbox')
  // a voice note being recorded into a new input here: its row comes first, with how long so far (B627)
  const recording = useStoreValue(stores.recording, (st) => (st.rec && st.rec.slug === route.slug && !st.rec.about && st.rec.key === NEW_DRAFT ? clock(st.rec.ms) : null))
  // more being said into one of them, on its own line (its Voice): "r12 0:07"
  const adding = useStoreValue(stores.recording, (st) => {
    const t = st.rec && st.rec.slug === route.slug ? draftTarget(st.rec.key) : null
    return t?.kind === 'amend' && t.mode === 'append' ? `${t.id} ${clock(st.rec?.ms ?? 0)}` : null
  })
  // and on its way there once stopped, until Taska has it: "r12 r40"
  const onItsWay = useStoreValue(stores.box, (st) =>
    Object.entries(st.files)
      .map(([k, fs]) => ({ t: draftTarget(k), fs }))
      .filter(({ t, fs }) => t.kind === 'amend' && t.mode === 'append' && fs.some((f) => f.uploading && (f.mime || '').startsWith('audio/')))
      .map(({ t }) => (t.kind === 'amend' ? t.id : ''))
      .join(' '),
  )
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const outbox = useStoreValue(stores.outbox, (s) => s.list)
  const drafts = useStoreValue(stores.drafts, (s) => s.bySlug[route.slug]) || EMPTY
  const mode = useStoreValue(stores.box, (s) => s.mode)
  const justSent = useStoreValue(stores.box, (s) => s.sent)
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const { q, upTo, opened } = view
  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q])
  const said = useMemo(() => (m ? saidRows(m, { words, upTo, opened, justSent, drafts, mode, title: (s) => projects?.find((p) => p.name === s)?.title || s, adding: new Set(onItsWay.split(' ')) }) : null), [m, words, upTo, opened, justSent, drafts, mode, projects, onItsWay])
  const media = useFiles(route.slug)
  if (!m || !said) return null
  const mine = outbox.filter((o) => o.slug === route.slug && !o.unsent && showsOnItsWay(o))
  const url = (f: string) => `/p/${encodeURIComponent(route.slug)}/f/${encodeURIComponent(f)}`
  return (
    <section aria-label="Latest inputs" data-vc-area className="mx-auto mt-8 block max-w-[42rem]">
      <SaidLately
        recording={recording}
        adding={adding ? { id: adding.slice(0, adding.indexOf(' ')), clock: adding.slice(adding.indexOf(' ') + 1) } : null}
        count={words.length ? said.all.length : m.inputs.length}
        total={m.inputs.length}
        q={q}
        rows={said.rows}
        outgoing={saidOutgoing(mine, words, away, justSent)}
        more={said.all.length > said.rows.length}
        words={words}
        draft={draft}
        files={(f) => <Thumbs files={f} url={url} size="size-16" play={media.play} tidy={media.tidy} on={media.on} />}
        on={{
          goto: (n) => app.nav.openItem(codeOf(m, n)),
          more: view.toggle,
          append: (id) => app.box.amendStart(route.slug, m, id, 'append'),
          voice: (id) => {
            const r = m.byId.get(id)
            void app.voice.addTo(route.slug, id, r?.scope ? codeOf(m, r.scope) : null)
          },
          draft: (id, mode) => app.box.amendStart(route.slug, m, id, mode),
          menu: (id, from) => app.sheets.openFrom(from, { kind: 'input-menu', id }, { focus: false }),
          undoSend: (k) => app.box.unsend(justSent.find((x) => x.q === k || x.rid === k)?.q ?? k),
          retry: (id) => app.inputActions.organizeAgain(route.slug, id),
          send: (id) => app.inputActions.sendCancelled(route.slug, id),
          outboxRetry: () => void app.inputs.flush(),
          outboxEdit: () => app.box.editOutgoing(route.slug, boxKey) && app.fields.focus('box'),
          query: view.query,
          loadMore: view.more,
          moved: (href) => app.nav.to(href),
        }}
      />
    </section>
  )
}

/** The draft at the top of what you said, while a voice note's words are there to check: its words, which ones may
 * be misheard (a tap picks another version), and a correction of words you select. */
export function DraftCardContainer({ route, boxKey, scope, fixing, setFixing }: { route: ProjectRoute; boxKey: DraftKey; scope: string | null; fixing: Fixing | null; setFixing(f: Fixing | null): void }) {
  const app = useServices('fields', 'toasts', 'voiceWords')
  const stores = useStores('box', 'drafts')
  const text = useStoreValue(stores.drafts, (s) => s.bySlug[route.slug]?.[boxKey]) ?? ''
  const draftFiles = useStoreValue(stores.box, (s) => s.files[boxKey])
  const heard = useHeard(text, draftFiles)
  const files = draftFiles || []
  const voice = files.filter((f) => (f.mime || '').startsWith('audio/'))
  if ((!text.trim() && !files.length) || (!voice.length && !heard.pickable)) return null
  const open = new Set(heard.spots.filter((p) => p.x.alt && !p.x.pick).map((p) => `${p.fk} ${p.k}`)).size
  const hint: DraftHint = open ? { kind: 'check', n: open } : heard.spots.some((p) => p.x.pick) ? { kind: 'switch' } : files.some((f) => f.trAdded && text.includes(f.trAdded)) ? { kind: 'fix' } : null
  const words = text.trim() ? (
    <DraftWords
      text={text}
      spots={heard.spots}
      stretches={voiceStretches(text, files)}
      fixing={fixing}
      className={DRAFT_WORDS}
      on={{
        pick: (fk, k, side) => void app.voiceWords.pick(route.slug, boxKey, fk, k, side),
        escape: () => app.fields.focus('box'),
        select: (s, e) => {
          const r = fixRange(text, s, e)
          if (r && 'error' in r) app.toasts.show(r.error)
          else if (r) setFixing(r)
        },
        fixSave: (right) => {
          setFixing(null)
          if (fixing) void app.voiceWords.fix(route.slug, boxKey, fixing, right, scope)
        },
        fixStop: () => setFixing(null),
      }}
    />
  ) : null
  return <DraftCard voice={voice.length} ms={voice.reduce((a, f) => a + (f.ms || 0), 0)} files={files.length - voice.length} transcribing={files.some((f) => f.transcribing)} words={words} hint={hint} />
}
