import { describe, expect, it } from 'vitest'
import type { ProjectModel } from '../model/project'
import { createBoxStore } from '../stores/box'
import { memoryVault } from '../stores/noteVault'
import { createOutboxStore } from '../stores/outbox'
import { memoryStore } from '../stores/storage'
import { KeptNotes } from './keptNotes'
import { NEW_DRAFT, replyDraft } from '../model/draftTarget'

const tick = () => new Promise((ok) => setTimeout(ok, 0))
const model = { byN: new Map(), byId: new Map(), docs: [], inputs: [], width: 2 } as unknown as ProjectModel

function page(vault = memoryVault()) {
  const box = createBoxStore(memoryStore())
  const outbox = createOutboxStore(memoryStore())
  const pushed: unknown[] = []
  const resumed: string[] = []
  const toasts: string[] = []
  const kept = new KeptNotes({
    vault,
    kv: memoryStore(),
    box,
    outbox,
    inputs: { push: (o: unknown) => pushed.push(o) } as never,
    toasts: { show: (t: string) => toasts.push(t) } as never,
    resume: (_s, key, f) => resumed.push(`${key} ${f.rid}`),
    place: () => {},
    draftName: (k) => k,
    goDraft: () => {},
    boxKey: () => NEW_DRAFT,
  })
  box.getState().show('p')
  return { box, outbox, kept, vault, pushed, resumed, toasts }
}

describe('voice notes kept over a reload', () => {
  it('keeps a note in its draft and puts it back there after a reload', async () => {
    const a = page()
    const rid = a.kept.id()
    a.kept.hold(rid, new Blob(['sound'], { type: 'audio/webm' }))
    a.box.getState().addFile(replyDraft('B12'), { key: rid, rid, f: '', name: 'voice 0-03.webm', mime: 'audio/webm', ms: 3000, uploading: true, transcribing: true })
    await tick()
    await tick()
    expect((await a.vault.all()).map((n) => [n.key, n.tr])).toEqual([['B12', null]])
    const b = page(a.vault)
    await b.kept.restore('p', model)
    expect(b.box.getState().files.new?.map((f) => f.rid)).toEqual([rid]) // B12 is not there any more: New input
    expect(b.resumed).toEqual([`new ${rid}`])
    expect(b.toasts).toEqual(['Voice note kept'])
  })
  it('lets it go once it is sent, and sends again one sent before the reload', async () => {
    const a = page()
    const rid = a.kept.id()
    a.kept.hold(rid, new Blob(['sound']))
    a.outbox.getState().push({ q: 'q1', slug: 'p', text: '', scope: null, files: [{ key: rid, rid, f: '', name: 'v.webm', mime: 'audio/webm', uploading: true }], t: 1, state: 'waiting', tries: 0 })
    await tick()
    await tick()
    expect((await a.vault.all()).map((n) => n.job?.id)).toEqual(['q1'])
    const b = page(a.vault)
    await b.kept.restore('p', model)
    expect(b.pushed).toHaveLength(1)
    a.outbox.getState().remove('q1')
    await tick()
    await tick()
    expect(await a.vault.all()).toEqual([])
  })
})
