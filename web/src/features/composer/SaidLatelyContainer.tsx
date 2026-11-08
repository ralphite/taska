// The desktop's New input page under the box, with the page's data: what you said lately (a page more at a time, each
// opened in full when asked), what is on its way, and the draft over it while a voice note's words are there to check;
// more being said into one of them on its line (F657), and on its way there.

import { useMemo, useState, type ReactNode } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { draftTarget } from '../../model/draftTarget'
import { useAway, useFiles, useItemWorld, useLitFades, useProjectModel, type ProjectRoute } from '../../app/hooks'
import type { DraftKey } from '../../model/draftTarget'
import { fixRange, voiceStretches } from '../../model/doubts'
import { codeOf, findRef } from '../../model/project'
import { inputWords } from '../../ui/Markdown'
import { saidOutgoing, saidRows } from '../../model/saidLately'
import { showsOnItsWay } from '../../model/outgoing'
import { notesState } from '../../model/voiceStates'
import { RecMeter } from '../../app/RecMeter'
import { FileChips } from '../../ui/Files'
import { PLACE_LEVELS } from '../../ui/PlaceVoice'
import { DraftWords, type Fixing } from './Doubts'
import { DraftCard, DRAFT_WORDS, type DraftHint } from './DraftCard'
import { SaidLately } from './SaidLately'
import { useHeard } from './heard'

const STEP = 30
const EMPTY: Record<string, string> = {}

/** What the list shows: how many rows, which are opened in full, More and Less (kept while the page shows other
 * places). */
export function useSaidView() {
  const [upTo, setUpTo] = useState(STEP)
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) => setOpened((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)))
  return { upTo, opened, more: () => setUpTo((u) => u + STEP), toggle }
}
export type SaidView = ReturnType<typeof useSaidView>

export function SaidLatelyContainer({ route, boxKey, view, draft }: { route: ProjectRoute; boxKey: DraftKey; view: SaidView; draft: ReactNode }) {
  const app = useServices('box', 'docs', 'fields', 'inputActions', 'inputs', 'nav', 'sheets', 'voice')
  const stores = useStores('box', 'recording', 'data', 'drafts', 'outbox', 'ui')
  // a voice note being recorded into a new input here: its row comes first, with how long so far (B627)
  // more being said into one of them, on its line (its Voice): which
  const adding = useStoreValue(stores.recording, (st) => {
    const t = st.rec && st.rec.slug === route.slug ? draftTarget(st.rec.key) : null
    return t?.kind === 'amend' && t.mode === 'append' ? t.id : null
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
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const lit = useStoreValue(stores.ui, (s) => s.lit)
  const { upTo, opened } = view
  const said = useMemo(() => (m ? saidRows(m, { upTo, lit, opened, drafts, mode, title: (s) => projects?.find((p) => p.name === s)?.title || s, adding: new Set(onItsWay.split(' ')) }) : null), [m, upTo, lit, opened, drafts, mode, projects, onItsWay])
  useLitFades(lit, !!lit && !!said?.rows.some((x) => x.r.id === lit))
  const media = useFiles(route.slug)
  const world = useItemWorld(m, route.slug)
  // a code in its words opens what it names, as the Inputs tab's do
  const openRef = (c: string) => {
    const to = m ? findRef(m, c) : null
    if (to?.kind === 'item' && m) app.nav.openItem(codeOf(m, to.n))
    else if (to?.kind === 'doc') app.docs.open(to.d)
  }
  if (!m || !said) return null
  const mine = outbox.filter((o) => o.slug === route.slug && !o.unsent && showsOnItsWay(o))
  const url = (f: string) => `/p/${encodeURIComponent(route.slug)}/f/${encodeURIComponent(f)}`
  return (
    <section aria-label="Latest inputs" data-vc-area className="mx-auto mt-8 block max-w-[42rem]">
      <SaidLately
        adding={adding ? { id: adding, meter: <RecMeter n={PLACE_LEVELS.desk} /> } : null}
        rows={said.rows}
        outgoing={saidOutgoing(mine, away)}
        lit={lit}
        more={said.all.length > said.rows.length}
        draft={draft}
        files={(f) => <FileChips files={f} url={url} play={media.play} tidy={media.tidy} on={media.on} />}
        words={inputWords(world, { ref: openRef, picture: (f, all) => media.on.view(f, all) })}
        on={{
          goto: (n) => app.nav.openItem(codeOf(m, n)),
          more: view.toggle,
          // Comment: the box at the top takes it, the cursor in it
          append: (id) => {
            app.box.amendStart(route.slug, m, id, 'append')
            requestAnimationFrame(() => app.fields.focus('box'))
          },
          voice: (id) => {
            const r = m.byId.get(id)
            void app.voice.addTo(route.slug, id, r?.scope ? codeOf(m, r.scope) : null)
          },
          draft: (id, mode) => app.box.amendStart(route.slug, m, id, mode),
          menu: (id, from) => app.sheets.openFrom(from, { kind: 'input-menu', id }, { focus: false }),
          cancel: (q) => app.box.cancel(q),
          retry: (id) => app.inputActions.organizeAgain(route.slug, id),
          send: (id) => app.inputActions.sendCancelled(route.slug, id),
          outboxRetry: () => void app.inputs.flush(),
          outboxEdit: () => app.box.editOutgoing(route.slug, boxKey) && app.fields.focus('box'),
          discard: () => void app.voice.cancel(),
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
  // every word still to check: two versions to pick from, or one a model was unsure of
  const open = new Set(heard.spots.filter((p) => !p.x.pick).map((p) => `${p.fk} ${p.k}`)).size
  const hint: DraftHint = open ? { kind: 'check', n: open } : files.some((f) => f.trAdded && text.includes(f.trAdded)) ? { kind: 'fix' } : null
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
  return <DraftCard voice={voice.length} ms={voice.reduce((a, f) => a + (f.ms || 0), 0)} files={files.length - voice.length} state={notesState(files)} words={words} hint={hint} />
}
