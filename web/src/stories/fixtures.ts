// Made-up data for stories: items, inputs and the facts a row or a list shows, each built from a few fields.

import { fn } from 'storybook/test'
import SHOT_SMALL from './assets/screenshot-search-small.jpg'
import { Diagrams } from '../app/page/diagrams'
import type { RowEvents, RowFacts, RowLook } from '../features/list/ListRows'
import { commentWithVoices, inputWithVoices, itemWithVoices, project, type ProjectModel } from '../model/project'
import type { Comment, Doc, Input, Item, Message, ProjectFacts, Voice, VoiceStep } from '../model/types'

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

/** An agent's message names its session, as a connected agent's does (T711); yours and the organizer's none. */
export function message(f: Partial<Message> & { id: number }): Message {
  const by = f.by ?? 'claude-code'
  return { by, kind: 'progress', text: 'Reproduced it: the export reads the list before the filter.', t: T, src: null, files: [], ...(by === 'you' || by === 'org' ? {} : { ses: 'Shop project work' }), ...f }
}

/** A voice note's words as Taska keeps them: its one record (B682). A story gives a note words only this way. */
export const record = (f: string, tidied: string, said = tidied, state: Voice['state'] = tidied ? 'done' : 'none'): Voice => ({ f, state, said, tidied })

/** The steps that worked out a note's words, as the server keeps them (T697): the strong and the speech model at
 * once, the strong one's words chosen, then tidied; `failed`: the strong model ran out of time, the speech model's
 * words were chosen. */
export const steps = (said: string, tidied: string, asr: string, failed = false): VoiceStep[] => [
  failed
    ? { step: 'pro', model: 'gemini-3.1-pro-preview', error: 'the strong model timed out after 10 s', secs: 10 }
    : { step: 'pro', model: 'gemini-3.1-pro-preview', text: said, secs: 3.8, chosen: true },
  { step: 'asr', model: 'gemini-3.5-transcribe', text: asr, secs: 2.1, ...(failed ? { chosen: true } : {}) },
  { step: 'tidy', model: 'gemini-3.5-flash', text: tidied, secs: 1.7, chosen: true },
]

/** A note whose words are still being worked out (`early`: its first words meanwhile). */
export const waiting = (f: string, early = ''): Voice => ({ f, state: 'wait', said: '', tidied: '', ...(early ? { early } : {}) })

/** What was said as the page's model shows it: its voice notes with their records' words, after what was typed. */
export const shown = (r: Input, ...voices: Voice[]): Input => inputWithVoices(r, new Map(voices.map((v) => [v.f, v])))

/** A comment as the page's model shows it, its voice notes' words from their records. */
export const shownComment = (c: Comment, ...voices: Voice[]): Comment => commentWithVoices(c, new Map(voices.map((v) => [v.f, v])))

/** An item as the page's model shows it: your messages with the words of their inputs' voice notes. */
export const shownItem = (it: Item, inputs: readonly Input[], ...voices: Voice[]): Item =>
  itemWithVoices(it, new Map(inputs.map((r) => [r.id, r])), new Map(voices.map((v) => [v.f, v])))

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

/** A small picture for a thumbnail: a real screenshot of Taska (its demo data), as people send them; never a drawing
 * that reads as a loading placeholder (B709). */
export const PICTURE = SHOT_SMALL

/** A project's facts as Taska is normally used: the organizer on, a coding agent around and waiting for work,
 * work waiting for it. A story of another setting says so in its name (…: organizer off). */
export function projectFacts(f: Partial<ProjectFacts> = {}): ProjectFacts {
  return {
    slug: 'taska',
    title: 'Taska',
    width: 3,
    file: '',
    organizer: { on: true, model: 'gemini-flash-latest', busy: [] },
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

/** A project's model made of these items and inputs, as the page would have it; a voice note's words come only from
 * its record (`voices`), as on the page (B682). */
export function modelOf(items: Item[], inputs: Input[] = [], f: Partial<ProjectFacts> = {}, docs: Doc[] = [], voices: Voice[] = []): ProjectModel {
  return project({
    cursor: '',
    items: new Map(items.map((it) => [it.n, it])),
    inputs: new Map(inputs.map((r) => [r.id, r])),
    docs: new Map(docs.map((d) => [d.d, d])),
    voices: new Map(voices.map((v) => [v.f, v])),
    facts: projectFacts(f),
    server: { page: '', update: false, dev: false },
    at: Date.parse(T),
  })
}
