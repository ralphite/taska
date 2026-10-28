// Made-up data for the item page's stories: what its talk draws with, what its taps do (nothing), its documents.

import type { ItemEvents, ItemFacts } from '../features/item/ItemPage'
import type { TalkFacts } from '../features/item/Talk'
import type { TalkEnv } from '../features/item/talkEnv'
import { codeOf, findRef, type ProjectModel } from '../model/project'
import type { Comment, Doc, Item } from '../model/types'
import { PICTURE, T } from './fixtures'

export function talkEnv(m: ProjectModel, desk: boolean, f: Partial<TalkEnv> = {}): TalkEnv {
  const url = (fid: string) => (/\.(png|jpe?g)$/.test(fid) ? PICTURE : '#' + fid)
  return {
    world: { find: (c) => findRef(m, c), url, size: () => undefined },
    now: Date.parse(T) + 60_000,
    desk,
    tidy: true,
    play: () => ({ playing: false, t: null }),
    url,
    opened: new Set(),
    latest: null,
    choosing: { picked: new Set(), pick: () => {} },
    ...f,
  }
}

export const talkFacts = (m: ProjectModel, f: Partial<TalkFacts> = {}): TalkFacts => ({
  inputs: m.byId,
  peeking: new Set(),
  reask: null,
  going: null,
  outgoing: [],
  undo: () => null,
  ...f,
})

export function itemFacts(m: ProjectModel, it: Item, f: Partial<ItemFacts> = {}): ItemFacts {
  return {
    code: (n) => codeOf(m, n),
    parent: it.parent ? m.byN.get(it.parent) : undefined,
    kids: m.kids.get(it.n) || [],
    files: [],
    sources: 0,
    docs: m.docs.filter((d) => d.n === it.n),
    remodify: false,
    allTalk: false,
    editing: false,
    addingSub: false,
    ...f,
  }
}

const no = () => {}
export const noItemEvents: ItemEvents = {
  decide: no, notYet: no, modify: no, cancelModify: no, sendAnswer: no, reask: no, cancelReask: no,
  ref: no, picture: no, more: no, play: no, words: no, view: no, topSize: no, duoSize: no,
  inputMore: no, inputHistory: no, goInput: no, msgMenu: no, peek: no, unhide: no, docAt: no, unsend: no, outboxRetry: no, outboxEdit: no,
  menu: no, set: no, sources: no, goto: no, doc: no, earlier: no, subNew: no, subAdd: no, subCancel: no, subTyped: no, editSave: no, editCancel: no, editTyped: no,
}

export const comment = (f: Partial<Comment> & { id: number }): Comment => ({ key: 'k1', th: f.id, quote: 'The export keeps the filter', text: 'Yes, and its name says which filter.', by: 'you', t: T, files: [], ...f })

export function doc(f: Partial<Doc> & { d: number; n: number }): Doc {
  return {
    title: 'Plan: the export keeps the filter',
    md: '# Plan\n\nThe export keeps the filter.',
    t0: T,
    t1: T,
    by: 'claude-code',
    versions: 1,
    fmt: 'md',
    blocks: [{ key: 'k1', kind: 'para', text: 'The export keeps the filter.', comments: [] }],
    detached: [],
    whole: [],
    unanswered: 0,
    resolved: {},
    ...f,
  }
}
