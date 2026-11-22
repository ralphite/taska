// A task's page with the page's data: what it shows (the task, its documents and files, your answer on its way,
// what you sent to it and Taska does not have yet, what you are doing on it) and what a tap on each part does.

import { useCallback, useEffect, type ReactNode } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { sessionsOn } from '../../model/agents'
import { useAway, useFiles, useTaskWorld } from '../../app/hooks'
import { CHOICE } from '../../model/markdown'
import { becameOf, madeFrom } from '../../model/became'
import { laterOn } from '../../model/time'
import type { Command } from '../../model/commands'
import { codeOf, docsOf, filesOf, findRef, liveN, sourceCount, type ProjectModel } from '../../model/project'
import { ticksNotSent } from '../../model/docTicks'
import { holdsUp, lastAgentMessage, waitsFor, workNews } from '../../model/tasks'
import { answerOf, latestMessage } from '../../model/talk'
import type { Task } from '../../model/types'
import { inTab, tabOf } from '../../model/visible'
import type { Tab } from '../../model/words'
import { inTalk, outgoingLine, outgoingText } from '../../model/outgoing'
import { outgoingIn } from '../../model/outgoingStates'
import { withVoice } from '../../model/voices'
import { isAudio } from '../../ui/Files'
import { TaskPage, type TaskEvents, type TaskFacts } from './TaskPage'
import type { Outgoing, TalkFacts } from './Talk'
import type { TalkEnv } from './talkEnv'
import type { App } from '../../app/createApp'
import { replyDraft } from '../../model/draftTarget'

/** The task's menu: under the button on the desktop (one field's choices from its chip), a sheet on the phone. */
/** Later's choices (D115 #21): at the button on the desktop, a sheet on the phone. */
export function openLater(app: Pick<App, 'sheets'>, desk: boolean, n: number, from: Element | null) {
  if (desk && from) app.sheets.openFrom(from, { kind: 'later', n }, { focus: false })
  else app.sheets.open({ kind: 'later', n }, { focus: false })
}

export function openTaskMenu(app: Pick<App, 'sheets'>, desk: boolean, n: number, arm: 's' | 'p' | 't' | null, from: Element | null) {
  if (desk) app.sheets.openFrom(from, { kind: 'task-menu', n, arm }, { focus: false, narrow: !!arm })
  else app.sheets.open({ kind: 'task-menu', n, arm }, { focus: false })
}

export function TaskPageContainer({ it, m, slug, tab, desk, left = null, bare = false, preview = false, onTalk }: { it: Task; m: ProjectModel; slug: string; tab: Tab; desk: boolean; /** in two columns, its document on the left */ left?: ReactNode; bare?: boolean; /** the search's preview of it: read only, not counted as seen or opened */ preview?: boolean; /** its talk's element, for the pane's button to its end (F716) */ onTalk?(el: HTMLElement | null): void }) {
  const app = useServices('answers', 'box', 'docs', 'fields', 'inputs', 'taskEdits', 'tasks', 'nav', 'runner', 'seen', 'sheets', 'toasts')
  const stores = useStores('data', 'docTicks', 'grips', 'taskView', 'keptEdits', 'outbox', 'recent', 'ui')
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const ticks = useStoreValue(stores.docTicks, (s) => s)
  // the search's preview is always one column, whatever the page's own layout (r1070)
  const duo = useStoreValue(stores.ui, (s) => s.duo) && desk && !preview
  const view = useStoreValue(stores.taskView, (s) => s)
  const kept = useStoreValue(stores.keptEdits, (s) => s)
  const outbox = useStoreValue(stores.outbox, (s) => s.list)
  const away = useAway(slug)
  const world = useTaskWorld(m, slug)
  const n = it.n
  // the talk: for the keys (Space scrolls it) and for the pane round it (its button to the end, F716)
  const fieldRef = app.fields.ref('talk')
  const talkRef = useCallback(
    (el: HTMLElement | null) => {
      fieldRef(el)
      onTalk?.(el)
    },
    [fieldRef, onTalk],
  )
  const code = (k: number | null | undefined) => codeOf(m, k)
  const ref = code(n)
  // seen once it shows: what its agents wrote has no dot on its row any more
  const lastAgentT = lastAgentMessage(it)?.t
  useEffect(() => (preview ? undefined : app.seen.see(slug, n, lastAgentT, !!it.archived)), [app, slug, n, lastAgentT, it.archived, preview])
  // opened: one of the search's Recent
  useEffect(() => {
    if (!preview) stores.recent.getState().saw({ project: slug, kind: 'tasks', n, code: ref, title: it.title, status: it.status, pri: it.pri })
  }, [stores, preview, slug, n, ref, it.title, it.status, it.pri])

  // the open question's choices: picked here, or before a reload (kept by their words)
  void view.choice
  const picked = app.answers.picked(it)
  const choosing = { picked, pick: (i: number, multi: boolean) => app.answers.pick(it, i, multi) }

  const shown = inTalk(it.thread, m.byId)
  const mine = outbox.filter((o) => o.slug === slug && o.scope === ref && !shown.has(o.q))
  const answering = mine.filter((o) => o.kind === 'answer').flatMap((o) => {
    const card = outgoingIn(o, away, 'card')
    return card ? [{ text: o.text, card, ...(o.of?.length ? { of: o.of } : {}) }] : []
  }).at(-1)
  const outgoing: Outgoing[] = mine
    .filter((o) => !(o.kind === 'answer' && !o.files.length))
    .flatMap((o) => {
      const show = outgoingIn(o, away, 'talk')
      if (!show) return []
      const previews = o.files.flatMap((f) => (f.preview ? [f.preview] : []))
      // its voice notes in the bubble (T668), so no "Voice note" words for them
      const voices = o.kind === 'cancelled' ? [] : o.files.filter(isAudio).map((f) => (f.f ? withVoice(f, m.voices) : f))
      return [{ q: o.q, text: outgoingText(o, m.voices) || (previews.length || voices.length ? '' : outgoingLine(o)), show, previews, voices }]
    })

  const media = useFiles(slug)
  const env: TalkEnv = {
    world,
    now: m.at,
    desk,
    tidy: media.tidy,
    play: media.play,
    url: world.url,
    opened: view.opened,
    latest: latestMessage(it),
    choosing,
  }
  const facts: TalkFacts = {
    inputs: m.byId,
    peeking: view.peeking,
    reask: view.reask,
    going: answering ?? null,
    outgoing,
    became: (id) => {
      const r = m.byId.get(id)
      return r ? becameOf(r, m, (s) => projects?.find((p) => p.name === s)?.title || s) : null
    },
    made: (id) => {
      const r = m.byId.get(id)
      return r ? madeFrom(r, m) : []
    },
  }
  const f: TaskFacts = {
    code,
    parent: it.parent ? m.byN.get(it.parent) : undefined,
    kids: m.kids.get(n) || [],
    files: filesOf(m, it),
    sources: sourceCount(m, it),
    laterOn: laterOn(it, m.at),
    // the sessions on it, at the top of its page (T858): what it said last, from the one that wrote last
    workers: sessionsOn(m.facts.agents, n, m.at).map((s) => {
      const news = it.agent?.ses === s.name ? workNews(it, m.at) : null
      return { ...s, text: news?.text ?? '', age: news?.age ?? '' }
    }),
    docs: docsOf(m, n),
    docWaiting: Object.fromEntries(docsOf(m, n).map((d) => [d.d, ticksNotSent(ticks, d)])),
    remodify: view.remodify === n,
    editing: view.editing === n,
    editDraft: kept.edits[n] ?? null,
    subDraft: kept.subs[n],
    addingSub: view.subFor === n,
    waitsFor: waitsFor(m.byN, it),
    blocks: holdsUp(m.tasks, it),
  }

  const iv = () => stores.taskView.getState()
  const goto = (k: number) => {
    const to = m.byN.get(liveN(m, k))
    if (to) app.nav.openTask(code(to.n), inTab(to, tab) ? undefined : tabOf(to))
  }
  const send = (command: Command, said: string) => app.runner.change(slug, command, said)
  const on: TaskEvents = {
    tag: (t) => app.nav.showTag(t),
    decide: (k, status) => {
      iv().setRemodify(null)
      void app.tasks.change(k, 'status', status)
    },
    notYet: (k) => {
      iv().setRemodify(null)
      void app.tasks.change(k, 'status', 'open', { said: 'is back to open' })
    },
    modify: (k) => {
      iv().setRemodify(k)
      app.toasts.hide(true)
    },
    cancelModify: () => iv().setRemodify(null),
    sendAnswer: () => void app.answers.send(m, slug, it),
    sendRow: (_k, of, text) => app.answers.sendRow(m, slug, it, of, text),
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
        void app.tasks.change(n, 'archived', v)
        if (v) app.nav.closeTask()
      } else void app.tasks.change(n, field, v)
    },
    menu: (arm, from) => openTaskMenu(app, desk, n, arm, from),
    later: (from) => openLater(app, desk, n, from),
    sources: () => app.sheets.open({ kind: 'task-sources', n }),
    agents: () => app.sheets.open({ kind: 'agents' }),
    times: () => app.sheets.open({ kind: 'task-times', n }),
    goto,
    doc: (d: number) => app.docs.open(d),
    more: (id) => iv().toggleOpened(id),
    ref: (c) => {
      const to = findRef(m, c)
      if (to?.kind === 'task') goto(to.n)
      else if (to?.kind === 'doc') app.docs.open(to.d)
      else if (to?.kind === 'input') app.nav.goInput(to.id)
    },
    picture: (f, all) => media.on.view(f, all),
    ...media.on,
    topSize: (px, done) => (done ? stores.grips.getState().keep('top', px) : stores.grips.getState().size('top', px)),
    duoSize: (px, done) => (done ? stores.grips.getState().keep('duo', px) : stores.grips.getState().size('duo', px)),
    subNew: () => app.taskEdits.subStart(n),
    subCancel: () => app.taskEdits.subCancel(),
    subTyped: (title) => app.taskEdits.subTyped(n, title),
    subAdd: (title) => {
      // same kind, priority and now/later as the parent; it shows under its parent at once (its code "…")
      void send({ op: 'new', title, parent: ref, pri: it.pri, when: it.when }, `adding “${title}” under ${ref}`)
      app.taskEdits.subAdded(n)
      stores.ui.getState().unfold(n)
    },
    editSave: (fields) => {
      const was = { title: it.title, body: it.body, next: it.next }
      void send({ op: 'set', ref, f: fields }, `${ref} edited`).then((ok) => {
        if (!ok) return
        app.taskEdits.saved(n)
        const back = app.toasts.undoable(`${ref} edited`, () => send({ op: 'set', ref, f: was }, `putting ${ref} back`).then((done) => (done && app.toasts.show(`${ref} put back`), done)))
        app.toasts.show('Saved', back)
      })
    },
    editCancel: () => app.taskEdits.cancel(),
    editTyped: (fields) => app.taskEdits.typed(it, fields),
    inputMore: (id, from) => (desk ? app.sheets.openFrom(from, { kind: 'input-menu', id }, { focus: false }) : app.sheets.open({ kind: 'input-menu', id }, { focus: false })),
    inputHistory: (id) => app.sheets.open({ kind: 'input-history', id }),
    goInput: (id) => app.nav.goInput(id),
    moved: (href) => app.nav.to(href),
    msgMenu: (id, from) => (desk ? app.sheets.openFrom(from, { kind: 'message-menu', n, id }, { focus: false }) : app.sheets.open({ kind: 'message-menu', n, id }, { focus: false })),
    peek: (id) => iv().peek(id),
    unhide: (id) => void send({ op: 'hide', ref, id, on: false }, `showing a message on ${ref} again`),
    docAt: (d, key) => app.docs.openAt(d, key),
    cancel: (q) => app.box.cancel(q),
    outboxRetry: (q) => app.inputs.retry(q),
    outboxEdit: (q) => app.box.editOutgoing(slug, replyDraft(ref), q, away) && app.fields.focus('box'),
  }
  return <TaskPage it={it} f={f} env={env} facts={facts} on={on} talkRef={preview ? undefined : talkRef} duo={duo} left={left} bare={bare} readOnly={preview} />
}
