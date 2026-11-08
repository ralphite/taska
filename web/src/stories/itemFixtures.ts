// Made-up data for the item page's stories: what its talk draws with, what its taps do (the Actions panel), its
// documents.

import type { ItemEvents, ItemFacts } from '../features/item/ItemPage'
import type { TalkFacts } from '../features/item/Talk'
import type { TalkEnv } from '../features/item/talkEnv'
import { madeFrom } from '../model/became'
import { laterOn } from '../model/time'
import { codeOf, filesOf, findRef, sourceCount, type ProjectModel } from '../model/project'
import type { Comment, Doc, Item } from '../model/types'
import { DIAGRAMS, PICTURE, T } from './fixtures'
import { acts } from './acts'

export function talkEnv(m: ProjectModel, desk: boolean, f: Partial<TalkEnv> = {}): TalkEnv {
  const url = (fid: string) => (/\.(png|jpe?g)$/.test(fid) ? PICTURE : '#' + fid)
  return {
    world: { find: (c) => findRef(m, c), url, size: () => undefined, diagram: (src, dark, id) => DIAGRAMS.draw(src, dark, id) },
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
  title: (s) => (s === 'mobile-app' ? 'Mobile app' : s),
  made: (id) => {
    const r = m.byId.get(id)
    return r ? madeFrom(r, m) : []
  },
  ...f,
})

export function itemFacts(m: ProjectModel, it: Item, f: Partial<ItemFacts> = {}): ItemFacts {
  return {
    code: (n) => codeOf(m, n),
    parent: it.parent ? m.byN.get(it.parent) : undefined,
    kids: m.kids.get(it.n) || [],
    files: filesOf(m, it),
    sources: sourceCount(m, it),
    laterOn: laterOn(it, m.at),
    docs: m.docs.filter((d) => d.n === it.n),
    remodify: false,
    editing: false,
    addingSub: false,
    ...f,
  }
}

/** The item page's handlers: each shows in Storybook's Actions panel (what needs Taska or the rest of the page). */
export const noItemEvents: ItemEvents = acts('Item', [
  'decide', 'notYet', 'modify', 'cancelModify', 'sendAnswer', 'reask', 'cancelReask', 'later',
  'ref', 'picture', 'more', 'play', 'words', 'view', 'topSize', 'duoSize',
  'inputMore', 'inputHistory', 'goInput', 'moved', 'msgMenu', 'peek', 'unhide', 'docAt', 'cancel', 'outboxRetry', 'outboxEdit',
  'menu', 'set', 'sources', 'times', 'goto', 'doc', 'subNew', 'subAdd', 'subCancel', 'subTyped', 'editSave', 'editCancel', 'editTyped',
] as const, { sources: 'Sheets › An item: what it came from', inputMore: 'What you said: its menu', inputHistory: 'Sheets › An input: its words and history' })

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
