// Made-up data for stories: items, inputs and the facts a row or a list shows, each built from a few fields.

import { fn } from 'storybook/test'
import { Diagrams } from '../app/page/diagrams'
import type { RowEvents, RowFacts, RowLook } from '../features/list/ListRows'
import { project, type ProjectModel } from '../model/project'
import type { Doc, Input, Item, Message, ProjectFacts } from '../model/types'

export const T = '2026-10-23T14:30:00-07:00'

/** Mermaid diagrams drawn as the page draws them (the page's own drawing, one for every story) */
export const DIAGRAMS = new Diagrams()

export function item(f: Partial<Item> & { n: number }): Item {
  return {
    code: 'F' + String(f.n).padStart(3, '0'),
    type: 'feature',
    title: 'Export ignores the active filter',
    body: '',
    pri: 'P2',
    when: 'now',
    status: 'open',
    parent: null,
    next: '',
    srcs: [],
    mergedInto: null,
    archived: false,
    t0: T,
    t1: T,
    by: 'you',
    thread: [],
    wait: null,
    talked: false,
    ...f,
  }
}

export function message(f: Partial<Message> & { id: number }): Message {
  return { by: 'claude-code', kind: 'progress', text: 'Reproduced it: the export reads the list before the filter.', t: T, src: null, files: [], ...f }
}

export function input(f: Partial<Input> & { id: string }): Input {
  return { t: T, by: 'you', text: 'The export should keep the filter I set.', scope: null, files: [], acked: false, touched: [], org: null, seq: 1, v: 0, ...f }
}

export function facts(f: Partial<RowFacts> = {}): RowFacts {
  return { code: 'F012', parentCode: null, image: null, kids: null, openKids: 0, talk: 0, draft: false, next: false, unread: false, worker: null, news: null, hitLine: null, ...f }
}

export const look = (desk: boolean, f: Partial<RowLook> = {}): RowLook => ({ current: false, selected: false, words: [], desk, ...f })

/** A row's handlers: each shows in Storybook's Actions panel (opening an item, changing one needs the rest of the
 * page). */
export const noRowEvents: RowEvents = {
  open: fn().mockName('Row: open'),
  act: fn().mockName('Row: act'),
  need: fn().mockName('Row: need'),
  reopen: fn().mockName('Row: reopen'),
  fold: fn().mockName('Row: fold'),
  goto: fn().mockName('Row: goto'),
  picture: fn().mockName('Row: picture'),
}

/** A small picture, drawn here, for a row's thumbnail. */
export const PICTURE =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#dbeafe"/><rect x="10" y="12" width="44" height="8" rx="2" fill="#60a5fa"/><rect x="10" y="28" width="60" height="6" rx="2" fill="#93c5fd"/><rect x="10" y="40" width="36" height="6" rx="2" fill="#93c5fd"/></svg>')

/** A project's facts as Taska is normally used: the organizer on, a coding agent around and waiting for work,
 * work waiting for it. A story of another setting says so in its name (…: organizer off). */
export function projectFacts(f: Partial<ProjectFacts> = {}): ProjectFacts {
  return {
    slug: 'taska',
    title: 'Taska',
    width: 3,
    file: '',
    organizer: { on: true, model: 'gemini-flash-latest', busy: null },
    agents: [{ name: 'claude-code', t: Date.parse(T), waiting: true }],
    work: true,
    agentsVersion: 0,
    undo: [],
    deletedInputs: [],
    deleted: [],
    base: '',
    key: '',
    remote: '',
    lan: '',
    ...f,
  }
}

/** A project's model made of these items and inputs, as the page would have it. */
export function modelOf(items: Item[], inputs: Input[] = [], f: Partial<ProjectFacts> = {}, docs: Doc[] = []): ProjectModel {
  return project({
    cursor: '',
    items: new Map(items.map((it) => [it.n, it])),
    inputs: new Map(inputs.map((r) => [r.id, r])),
    docs: new Map(docs.map((d) => [d.d, d])),
    facts: projectFacts(f),
    server: { page: '', update: false },
    at: Date.parse(T),
  })
}
