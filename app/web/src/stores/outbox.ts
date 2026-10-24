// What you sent that the server does not have yet: sending never holds the box; inputs go out in order, each once its
// files are up. An input whose files are all up is kept in this browser ("taska.outbox.<project>": {q: {text, scope,
// t, kind?, files}}, the format pages have always kept them in), so a reload or a closed tab never loses it.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { FileRef } from '../model/types'
import type { KeyValueStore } from './storage'

export interface OutFile extends FileRef {
  /** still being uploaded */
  uploading?: boolean
  failed?: boolean
  /** a picture's look before it is up (this page only) */
  preview?: string
  /** the page's own id for it while it goes up */
  key?: string
  /** kept in this browser (with its audio) under this id until Taska has it */
  rid?: string
}

export interface Outgoing {
  /** the page's id for it: the server takes it once */
  q: string
  slug: string
  text: string
  /** the item it replies on (its code), or null for a new input */
  scope: string | null
  kind?: 'answer'
  files: OutFile[]
  t: number
  state: 'waiting' | 'sending' | 'failed'
  /** failed because the server was away (it goes again by itself) */
  net?: boolean
  tries: number
  /** sent before a reload, going out again now */
  back?: boolean
  /** its toast says nothing (an answer, a note with a decision) */
  quiet?: boolean
  /** taken back while on its way: deleted once the server has it */
  unsent?: boolean
}

export interface OutboxState {
  list: Outgoing[]
  push(o: Outgoing): void
  update(q: string, f: Partial<Outgoing>): void
  /** one of the files on their way is up (or failed) */
  updateFile(fileKey: string, patch: Partial<OutFile>): void
  remove(q: string): void
}

export type OutboxStore = StoreApi<OutboxState>

const KEY = 'taska.outbox.'

interface Kept {
  text?: string
  scope?: string | null
  t?: number
  kind?: 'answer'
  files?: FileRef[]
}

const keepable = (o: Outgoing) => o.files.every((f) => f.f && !f.uploading)

export function createOutboxStore(kv: KeyValueStore): OutboxStore {
  const keep = (slug: string, list: Outgoing[]) => {
    const all: Record<string, Kept> = {}
    for (const o of list)
      if (o.slug === slug && keepable(o))
        all[o.q] = {
          text: o.text,
          scope: o.scope,
          t: o.t,
          ...(o.kind ? { kind: o.kind } : {}),
          files: o.files.map(({ f, name, mime, size }) => ({ f, name, mime, size })),
        }
    kv.setJson(KEY + slug, Object.keys(all).length ? all : null)
  }
  return createStore<OutboxState>()((set, get) => ({
    list: [],
    push: (o) => {
      set((s) => ({ list: [...s.list, o] }))
      keep(o.slug, get().list)
    },
    updateFile: (fileKey, patch) => {
      const touched = new Set<string>()
      set((s) => ({
        list: s.list.map((o) => {
          if (!o.files.some((x) => x.key === fileKey)) return o
          touched.add(o.slug)
          return { ...o, files: o.files.map((x) => (x.key === fileKey ? { ...x, ...patch } : x)) }
        }),
      }))
      for (const slug of touched) keep(slug, get().list)
    },
    update: (q, f) => {
      const o = get().list.find((x) => x.q === q)
      if (!o) return
      set((s) => ({ list: s.list.map((x) => (x.q === q ? { ...x, ...f } : x)) }))
      keep(o.slug, get().list)
    },
    remove: (q) => {
      const o = get().list.find((x) => x.q === q)
      if (!o) return
      set((s) => ({ list: s.list.filter((x) => x.q !== q) }))
      keep(o.slug, get().list)
    },
  }))
}

/** What did not go out before a reload, in every project, in the order it was sent. */
export function keptOutgoing(kv: KeyValueStore): Outgoing[] {
  const out: Outgoing[] = []
  for (const key of kv.keys()) {
    if (!key.startsWith(KEY)) continue
    const slug = key.slice(KEY.length)
    for (const [q, k] of Object.entries(kv.getJson<Record<string, Kept>>(key) || {}))
      out.push({
        q,
        slug,
        text: k.text || '',
        scope: k.scope || null,
        t: k.t || Date.now(),
        ...(k.kind ? { kind: k.kind } : {}),
        files: (k.files || []).map((f) => ({ ...f })),
        state: 'waiting',
        tries: 0,
        back: true,
      })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** The first line of what you sent, as the lists show it while it is on its way. */
export const outgoingLine = (o: Pick<Outgoing, 'text' | 'files'>) =>
  o.text.split('\n')[0] ||
  (o.files.some((f) => (f.mime || '').startsWith('audio/')) ? 'Voice note' : `${o.files.length} file${o.files.length === 1 ? '' : 's'}`)

/** Where it is, in a few words: on its way, waiting for Taska (away), uploading its files, or not sent. */
export const outgoingState = (o: Outgoing, away: number) =>
  o.state === 'failed' && !o.net ? 'Not sent' : o.state === 'failed' || away >= 2 ? 'Waiting for Taska…' : o.files.some((f) => f.uploading) ? 'Uploading…' : 'Sending…'
