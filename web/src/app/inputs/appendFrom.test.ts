import { describe, expect, it } from 'vitest'
import { draftKey, replyDraft } from '../../model/draftTarget'
import type { ProjectModel } from '../../model/project'
import { createBoxStore } from '../../stores/box'
import { createDraftsStore } from '../../stores/drafts'
import { createOutboxStore } from '../../stores/outbox'
import { memoryStore } from '../../stores/storage'
import { Box } from './box'
import { DraftSender } from './draftSender'

const tick = () => new Promise((ok) => setTimeout(ok, 0))
const r12 = { id: 'r12', text: 'Keep the filter.', v: 3, files: [] }
const model = { byId: new Map([['r12', r12]]), byN: new Map(), docs: [], inputs: [r12], width: 2 } as unknown as ProjectModel
const ADD = draftKey({ kind: 'amend', mode: 'append', id: 'r12' })

/** A voice note said on an input's own line (F657) goes as Add more goes, whatever the box writes meanwhile. */
function page() {
  const store = createBoxStore(memoryStore())
  const drafts = createDraftsStore(memoryStore())
  const sent: unknown[] = []
  const pushed: unknown[] = []
  const toasts: string[] = []
  const box = new Box({
    api: {} as never,
    store,
    drafts,
    outbox: createOutboxStore(memoryStore()),
    inputs: { push: (o: unknown) => (pushed.push(o), { q: 'q1' }), flush: async () => {} } as never,
    runner: { send: async (c: { commands: unknown[] }) => (sent.push(...c.commands), true) } as never,
    toasts: { show: (t: string) => toasts.push(t) } as never,
  })
  store.getState().show('p')
  const sender = new DraftSender({ box, boxStore: store, inputs: { push: (o: unknown) => pushed.push(o) } as never, docVoice: () => ({}) as never, model: () => model })
  const note = (uploading: boolean) => store.getState().addFile(ADD, { key: 'v1', f: uploading ? '' : 'f9.webm', name: 'voice 0-04.webm', mime: 'audio/webm', size: 9, ms: 4000, uploading, transcript: 'wait' })
  return { store, box, sender, sent, pushed, toasts, note }
}

describe("more said on an input's own line", () => {
  it('is added to that input, not sent as a new one, and the box goes on with what it writes', async () => {
    const a = page()
    a.store.getState().setMode({ kind: 'amend', id: 'r30', mode: 'edit', v: 0, base: '' })
    a.note(false)
    a.sender.send('p', ADD)
    await tick()
    expect(a.pushed).toEqual([])
    expect(a.sent).toEqual([{ op: 'amend', id: 'r12', mode: 'append', v: 3, text: '', files: [{ f: 'f9.webm', name: 'voice 0-04.webm', mime: 'audio/webm', size: 9 }] }])
    expect(a.store.getState().files[ADD] ?? []).toEqual([])
    expect(a.store.getState().mode).toEqual({ kind: 'amend', id: 'r30', mode: 'edit', v: 0, base: '' })
    expect(a.toasts).toEqual(['Added to #12'])
  })
  it('waits for its upload without saying so, then goes', async () => {
    const a = page()
    a.note(true)
    expect(a.box.appendFrom('p', model, 'r12')).toBe(true)
    await tick()
    expect(a.sent).toEqual([])
    a.store.getState().updateFile('v1', { f: 'f9.webm', uploading: false })
    await tick()
    expect(a.sent).toHaveLength(1)
    expect(a.toasts).toEqual(['Added to #12'])
  })
  it('a new input or a reply still goes as before', () => {
    const a = page()
    a.box.write('p', replyDraft('F12'), 'Also the sort.')
    a.sender.send('p', replyDraft('F12'))
    expect(a.pushed).toHaveLength(1)
    expect(a.box.appendFrom('p', model, 'r99')).toBe(false)
  })
})
