import { describe, expect, it } from 'vitest'
import { replyDraft } from '../../model/draftTarget'
import type { ProjectModel } from '../../model/project'
import { createBoxStore } from '../../stores/box'
import { createDraftsStore } from '../../stores/drafts'
import { createOutboxStore } from '../../stores/outbox'
import { memoryStore } from '../../stores/storage'
import { Box } from './box'

const model = { byId: new Map(), byN: new Map(), docs: [], inputs: [], width: 1 } as unknown as ProjectModel

function page() {
  const store = createBoxStore(memoryStore())
  const drafts = createDraftsStore(memoryStore())
  const pushed: Record<string, unknown>[] = []
  const box = new Box({
    api: {} as never,
    store,
    drafts,
    outbox: createOutboxStore(memoryStore()),
    inputs: { push: (o: Record<string, unknown>) => (pushed.push(o), { q: 'q1' }), flush: async () => {} } as never,
    runner: {} as never,
    toasts: { show: () => {} } as never,
  })
  store.getState().show('p')
  let ended = 0
  const answer = { text: '✓ Staging first', done: () => ended++ }
  return { box, drafts, pushed, answer, ended: () => ended }
}

describe('an answer with words (T145, T802)', () => {
  it('the choices picked and what you wrote in the box go as one answer, whichever you send with', () => {
    const a = page()
    a.drafts.getState().set('p', replyDraft('T5'), 'and keep the old one a week')
    expect(a.box.send('p', model, 'T5', replyDraft('T5'), a.answer)).toBe(true)
    expect(a.pushed).toEqual([expect.objectContaining({ text: '✓ Staging first\n\nand keep the old one a week', scope: 'T5', kind: 'answer' })])
    expect(a.drafts.getState().of('p')[replyDraft('T5')] || '').toBe('')
    expect(a.ended()).toBe(1)
  })
  it('the choices alone go when nothing is written', () => {
    const a = page()
    a.box.send('p', model, 'T5', replyDraft('T5'), a.answer)
    expect(a.pushed).toEqual([expect.objectContaining({ text: '✓ Staging first', kind: 'answer' })])
  })
  it('words with nothing picked go as a reply, as before', () => {
    const a = page()
    a.drafts.getState().set('p', replyDraft('T5'), 'not sure yet')
    a.box.send('p', model, 'T5', replyDraft('T5'), null)
    expect(a.pushed).toEqual([expect.objectContaining({ text: 'not sure yet', scope: 'T5' })])
    expect(a.pushed[0].kind).toBeUndefined()
  })
})
