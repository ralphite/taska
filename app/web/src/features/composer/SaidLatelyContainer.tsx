// The desktop's New input page under the box, with the page's data: what you said lately (searched, a page more at
// a time, each opened in full when asked), what is on its way, and the draft at the top of it while a voice note's
// words are there to check.

import { useMemo, useState, type ReactNode } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { useAway, useFiles, useProjectModel, type ProjectRoute } from '../../app/hooks'
import type { DraftKey } from '../../model/draftTarget'
import { fixRange, voiceStretches } from '../../model/doubts'
import { codeOf } from '../../model/project'
import { saidOutgoing, saidRows } from '../../model/saidLately'
import { Thumbs } from '../../ui/Files'
import { DraftWords, type Fixing } from './Doubts'
import { DraftCard, DRAFT_WORDS, type DraftHint } from './DraftCard'
import { SaidLately } from './SaidLately'
import { useHeard } from './heard'

const STEP = 30
const EMPTY: Record<string, string> = {}

/** What the list shows: its search, how many rows, which are opened in full (kept while the page shows other places). */
export function useSaidView() {
  const [q, setQ] = useState('')
  const [upTo, setUpTo] = useState(STEP)
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  return { q, upTo, opened, query: (v: string) => (setQ(v), setUpTo(STEP)), more: () => setUpTo((u) => u + STEP), open: (id: string) => setOpened((s) => new Set(s).add(id)) }
}
export type SaidView = ReturnType<typeof useSaidView>

export function SaidLatelyContainer({ route, boxKey, view, draft }: { route: ProjectRoute; boxKey: DraftKey; view: SaidView; draft: ReactNode }) {
  const app = useServices('box', 'fields', 'inputActions', 'inputs', 'nav', 'sheets')
  const stores = useStores('box', 'drafts', 'outbox')
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const outbox = useStoreValue(stores.outbox, (s) => s.list)
  const drafts = useStoreValue(stores.drafts, (s) => s.bySlug[route.slug]) || EMPTY
  const mode = useStoreValue(stores.box, (s) => s.mode)
  const justSent = useStoreValue(stores.box, (s) => s.sent)
  const { q, upTo, opened } = view
  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q])
  const said = useMemo(() => (m ? saidRows(m, { words, upTo, opened, justSent, drafts, mode }) : null), [m, words, upTo, opened, justSent, drafts, mode])
  const media = useFiles(route.slug)
  if (!m || !said) return null
  const mine = outbox.filter((o) => o.slug === route.slug && !o.unsent)
  const url = (f: string) => `/p/${encodeURIComponent(route.slug)}/f/${encodeURIComponent(f)}`
  return (
    <section aria-label="You said lately" data-vc-area className="mx-auto mt-8 block max-w-[42rem]">
      <SaidLately
        count={words.length ? said.all.length : m.inputs.length}
        total={m.inputs.length}
        q={q}
        rows={said.rows}
        outgoing={saidOutgoing(mine, words, away, justSent)}
        more={said.all.length > said.rows.length}
        words={words}
        draft={draft}
        files={(f) => <Thumbs files={f} url={url} size="size-12" play={media.play} tidy={media.tidy} on={media.on} />}
        on={{
          goto: (n) => app.nav.openItem(codeOf(m, n)),
          more: view.open,
          append: (id) => app.box.amendStart(route.slug, m, id, 'append'),
          draft: (id, mode) => app.box.amendStart(route.slug, m, id, mode),
          menu: (id, from) => app.sheets.openFrom(from, { kind: 'input-menu', id }, { focus: false }),
          undoSend: (k) => app.box.unsend(justSent.find((x) => x.q === k || x.rid === k)?.q ?? k),
          retry: (id) => app.inputActions.organizeAgain(route.slug, id),
          outboxRetry: () => void app.inputs.flush(),
          outboxEdit: () => app.box.editOutgoing(route.slug, boxKey) && app.fields.focus('box'),
          query: view.query,
          loadMore: view.more,
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
