// The phone's Inputs tab with the page's data: each input with where it stands and what became of it, newest first
// by day, and what is still on its way.

import { useMemo } from 'react'
import { useApp, useStoreValue } from '../../app/context'
import { useAway, useFiles, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { dayOf, newestFirst, standing } from '../../model/inputs'
import { codeOf, findRef, inputDraft, type ProjectModel } from '../../model/project'
import { when } from '../../model/time'
import { inputMatch, searchWords } from '../../model/visible'
import { inputCode } from '../../model/words'
import { outgoingLine, outgoingState } from '../../stores/outbox'
import { useItemWorld } from '../item/ItemPageContainer'
import { useSearchHints } from '../list/SearchHintsContainer'
import { Thumbs } from './Files'
import { InputsView, type InputFacts, type OutgoingRow } from './InputsView'

export function InputsContainer({ route, hidden }: { route: ProjectRoute; hidden: boolean }) {
  const app = useApp()
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const outbox = useStoreValue(app.stores.outbox, (s) => s.list)
  const opened = useStoreValue(app.stores.ui, (s) => s.openedInputs)
  const projects = useStoreValue(app.stores.data, (s) => s.projects)
  const words = useMemo(() => searchWords(route.list.q), [route.list.q])
  const world = useItemWorld(m, route.slug)
  const hints = useSearchHints(route, m, words)
  const draftWords = useStoreValue(app.stores.drafts, (s) => s.bySlug[route.slug])
  const mode = useStoreValue(app.stores.box, (s) => s.mode)
  const writing = useMemo(() => (mode?.kind === 'amend' ? { id: mode.id, mode: mode.mode } : null), [mode])
  const media = useFiles(route.slug)
  const lit = useStoreValue(app.stores.ui, (s) => s.lit)
  const rows: InputFacts[] = useMemo(() => {
    if (!m || hidden) return []
    const title = (slug: string) => projects?.find((p) => p.name === slug)?.title || slug
    const list = newestFirst(m.inputs).filter((r) => inputMatch(r, words))
    let day = ''
    return list.map((r): InputFacts => {
      const d = dayOf(r.t, new Date(m.at))
      const startsDay = d !== day
      day = d
      const st = standing(r, m.facts.organizer, title)
      // the chips say what was done with their items ("Created B224"); the note keeps only what no chip says
      const shown = r.moved ? [] : r.touched.filter((n) => m.byN.has(n) && n !== r.scope)
      const did: Record<number, string> = {}
      const rest: string[] = []
      for (const part of (r.org?.msg || '').split(' · ').map((p) => p.trim()).filter(Boolean)) {
        const mm = /^(.+?) ([A-Z]\d+)$/.exec(part)
        const n = mm ? Number(/\d+/.exec(mm[2])?.[0]) : null
        if (mm && n && shown.includes(n)) did[n] ||= mm[1]
        else rest.push(part)
      }
      const org = !r.moved && r.org && !(r.acked && r.org.keep)
      const told = (p: string) => p.toLowerCase() === st.label.toLowerCase() || (/^Left for your/.test(p) && /^Left for your/.test(st.label))
      const left = rest.filter((p) => !told(p))
      const note = org && left.length ? left.join(' · ') : null
      const scope = r.scope ? m.byN.get(r.scope) : undefined
      return {
        r,
        code: inputCode(r.id),
        time: when(r.t, m.at),
        day: startsDay ? d : null,
        standing: st,
        scope: scope ? { n: scope.n, code: codeOf(m, scope.n), title: scope.title } : null,
        chips: shown.map((n) => {
          const it = m.byN.get(n)!
          return { n, code: codeOf(m, n), type: it.type, title: it.title, did: did[n] || '' }
        }),
        note,
        noteBad: !r.org?.ok,
        spark: !!org && !note && shown.some((n) => did[n]),
        retry: !r.acked && m.facts.organizer.on && r.org && (!r.org.ok || r.org.undone) ? (r.org.undone ? 'Organize again' : 'Retry') : null,
        moved: r.moved ? { href: `/p/${encodeURIComponent(r.moved.to)}/`, label: `Open ${title(r.moved.to)} · ${inputCode(r.moved.as)}` } : null,
        lit: lit === r.id,
        draft: inputDraft(r.id, draftWords || app.stores.drafts.getState().of(route.slug), writing),
        long: r.text.length > 160 || r.text.split('\n').length > 4,
        opened: opened.has(r.id),
      }
    })
  }, [m, hidden, words, projects, opened, draftWords, app, route.slug, writing, lit])
  const outgoing: OutgoingRow[] = outbox
    .filter((o) => o.slug === route.slug)
    .reverse()
    .map((o) => ({ q: o.q, text: o.text || outgoingLine(o), state: outgoingState(o, away), bad: o.state === 'failed' && !o.net, scope: o.scope, previews: o.files.flatMap((f) => (f.preview ? [f.preview] : [])) }))
  return (
    <InputsView
      hidden={hidden}
      rows={rows}
      outgoing={outgoing}
      words={words}
      world={world}
      hints={hints(rows.length)}
      files={(f) => <Thumbs files={f} url={world.url} size="size-11" play={media.play} tidy={media.tidy} on={media.on} />}
      on={{
        goto: (n) => m && app.nav.openItem(codeOf(m, n), 'items'),
        more: (id) => app.stores.ui.getState().toggleInput(id),
        menu: (id) => app.sheets.open({ kind: 'input-menu', id }, { focus: false }),
        retry: (id) => app.inputActions.organizeAgain(route.slug, id),
        draft: (id, mode) => app.box.amendStart(route.slug, m, id, mode),
        moved: (href) => app.nav.to(href),
        ref: (c) => {
          const to = m ? findRef(m, c) : null
          if (to?.kind === 'item') app.nav.openItem(codeOf(m as ProjectModel, to.n), 'items')
          else if (to?.kind === 'doc') app.docs.open(to.d)
          else if (to?.kind === 'input') app.nav.goInput(to.id, (x) => app.stores.ui.getState().setLit(x))
        },
        picture: (f, all) => media.on.view(f, all),
      }}
    />
  )
}
