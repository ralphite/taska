// An item's page with the page's data: what it shows (the item, its documents and files, your answer on its way,
// what you sent to it and Taska does not have yet, what you are doing on it) and what a tap on each part does.

import { useMemo } from 'react'
import { useApp, useStoreValue } from '../../app/context'
import { useAway } from '../../app/hooks'
import { newId } from '../../app/changeRunner'
import { CHOICE } from '../../model/markdown'
import { codeOf, docsOf, filesOf, findRef, liveN, STAND, type ProjectModel } from '../../model/project'
import { answerOf } from '../../model/talk'
import type { Item } from '../../model/types'
import { inTab, tabOf } from '../../model/visible'
import type { Tab } from '../../model/words'
import { outgoingLine, outgoingState } from '../../stores/outbox'
import type { InlineWorld } from '../../ui/markdown/inline'
import { ItemPage, type ItemEvents, type ItemFacts } from './ItemPage'
import type { Outgoing, TalkFacts } from './Talk'
import type { TalkEnv } from './talkEnv'

export function useItemWorld(m: ProjectModel | null, slug: string): InlineWorld {
  return useMemo(
    () => ({
      find: (c: string) => (m ? findRef(m, c) : null),
      url: (f: string) => `/p/${encodeURIComponent(slug)}/f/${encodeURIComponent(f)}`,
      size: () => undefined,
    }),
    [m, slug],
  )
}

/** The item's menu: under the button on the desktop (one field's choices from its chip), a sheet on the phone. */
export function openItemMenu(app: ReturnType<typeof useApp>, desk: boolean, n: number, arm: 's' | 'p' | 't' | null, from: Element | null) {
  if (desk) app.sheets.openFrom(from, { kind: 'item-menu', n, arm }, { focus: false, narrow: !!arm })
  else app.sheets.open({ kind: 'item-menu', n, arm }, { focus: false })
}

export function ItemPageContainer({ it, m, slug, tab, desk }: { it: Item; m: ProjectModel; slug: string; tab: Tab; desk: boolean }) {
  const app = useApp()
  const view = useStoreValue(app.stores.itemView, (s) => s)
  const outbox = useStoreValue(app.stores.outbox, (s) => s.list)
  const away = useAway(slug)
  const world = useItemWorld(m, slug)
  const n = it.n
  const code = (k: number | null | undefined) => codeOf(m, k)
  const ref = code(n)

  // the open question's choices: picked here, or before a reload (kept by their words)
  void view.choice
  const picked = app.answers.picked(it)
  const choosing = { picked, pick: (i: number, multi: boolean) => app.answers.pick(it, i, multi) }

  const mine = outbox.filter((o) => o.slug === slug && o.scope === ref)
  const answering = mine.filter((o) => o.kind === 'answer').at(-1)
  const outgoing: Outgoing[] = mine
    .filter((o) => !(o.kind === 'answer' && !o.files.length))
    .map((o) => ({ q: o.q, text: o.text || outgoingLine(o), state: outgoingState(o, away), bad: o.state === 'failed' && !o.net }))

  const env: TalkEnv = {
    world,
    now: m.at,
    desk,
    tidy: true,
    play: () => ({ playing: false, t: null }),
    url: world.url,
    opened: view.opened,
    latest: it.thread.filter((x) => x.by !== 'org').at(-1)?.id ?? null,
    choosing,
  }
  const facts: TalkFacts = {
    inputs: m.byId,
    peeking: view.peeking,
    reask: view.reask,
    going: answering ? { text: answering.text, state: outgoingState(answering, away) } : null,
    outgoing,
    undo: () => null,
  }
  const f: ItemFacts = {
    code,
    parent: it.parent ? m.byN.get(it.parent) : undefined,
    kids: m.kids.get(n) || [],
    files: filesOf(m, it),
    sources: it.srcs.filter((id) => m.byId.get(id)?.kind !== 'answer').length,
    docs: docsOf(m, n),
    remodify: view.remodify === n,
    allTalk: view.talkAll.has(n),
    editing: view.editing === n,
    addingSub: view.subFor === n,
  }

  const iv = () => app.stores.itemView.getState()
  const goto = (k: number) => {
    const to = m.byN.get(liveN(m, k))
    if (to) app.nav.openItem(code(to.n), inTab(to, tab) ? undefined : tabOf(to))
  }
  const send = (commands: Parameters<typeof app.runner.send>[0]['commands'], said: string, patches: Parameters<typeof app.runner.send>[0]['patches'] = []) =>
    app.runner.send({ id: newId(), slug, commands, patches, said, t: Date.now() })
  const on: ItemEvents = {
    decide: (k, status) => {
      iv().setRemodify(null)
      void app.items.change(k, 'status', status)
    },
    notYet: (k) => {
      iv().setRemodify(null)
      void app.items.change(k, 'status', 'doing', { said: 'is back in progress' })
    },
    modify: (k) => {
      iv().setRemodify(k)
      app.toasts.hide(true)
    },
    cancelModify: () => iv().setRemodify(null),
    sendAnswer: () => void app.answers.send(m, slug, it),
    reask: (k, id) => {
      const x = it.thread.find((y) => y.id === id)
      if (!x) return
      const done = answerOf(it.thread, x, answering?.text ?? null) || []
      const ls = x.text.split('\n').flatMap((l) => (CHOICE.test(l) ? [l.replace(CHOICE, '').trim()] : []))
      iv().startReask(id, { n: k, picked: new Set(ls.flatMap((l, i) => (done.includes(l) ? [i] : []))) })
    },
    cancelReask: () => iv().endAnswer(),
    set: (field, v) => {
      if (field === 'archived') {
        void app.items.change(n, 'archived', v, { note: v ? 'Find it under Archive' : '' })
        if (v) app.nav.closeItem()
      } else void app.items.change(n, field, v)
    },
    menu: (arm, from) => openItemMenu(app, desk, n, arm, from),
    sources: () => app.sheets.open({ kind: 'item-sources', n }),
    goto,
    doc: (d: number) => app.docs.open(d),
    earlier: () => iv().showAll(n),
    more: (id) => iv().toggleOpened(id),
    ref: (c) => {
      const to = findRef(m, c)
      if (to?.kind === 'item') goto(to.n)
      else if (to?.kind === 'doc') app.docs.open(to.d)
    },
    picture: () => {},
    play: () => {},
    words: () => {},
    view: () => {},
    subNew: () => iv().setSubFor(n),
    subCancel: () => iv().setSubFor(null),
    subAdd: (title) => {
      // same kind, priority and now/later as the parent; it shows under its parent at once (its code "…")
      const type = it.type === 'rule' ? 'task' : it.type
      const tmp = STAND + (Date.now() % 1e11)
      const now = new Date().toISOString()
      const stand: Item = { ...it, n: tmp, code: '…', type, title, body: '', status: 'open', parent: n, next: '', thread: [], srcs: [], wait: null, talked: false, archived: false, rank: null, t0: now, t1: now, agent: undefined, readBy: undefined, by: 'you', decided: null }
      void send([{ op: 'new', title, parent: ref, type, pri: it.pri, when: it.when }], `adding “${title}” under ${ref}`, [{ n: tmp, f: {}, add: stand }])
      app.stores.ui.getState().unfold(n)
    },
    editSave: (fields) => {
      const was = { title: it.title, body: it.body, next: it.next }
      void send([{ op: 'set', ref, f: fields }], `${ref} edited`, [{ n, f: fields }]).then((ok) => {
        if (!ok) return
        iv().setEditing(null)
        const back = app.toasts.undoable(`${ref} edited`, () => send([{ op: 'set', ref, f: was }], `putting ${ref} back`, [{ n, f: was }]).then((done) => (done && app.toasts.show(`${ref} put back`), done)))
        app.toasts.show('Saved', back)
      })
    },
    editCancel: () => iv().setEditing(null),
    inputMore: (id) => app.sheets.open({ kind: 'input-menu', id }, desk ? { pop: true, focus: false } : { focus: false }),
    inputHistory: (id) => app.sheets.open({ kind: 'input-history', id }),
    goInput: () => {},
    msgMenu: (id) => app.sheets.open({ kind: 'message-menu', n, id }, desk ? { pop: true, focus: false, narrow: true } : { focus: false }),
    peek: (id) => iv().peek(id),
    unhide: (id) => void send([{ op: 'hide', ref, id, on: false }], `showing a message on ${ref} again`),
    docAt: () => {},
    unsend: () => {},
    outboxRetry: () => void app.inputs.flush(),
    outboxEdit: () => {},
  }
  return <ItemPage it={it} f={f} env={env} facts={facts} on={on} talkRef={app.fields.ref('talk')} />
}
