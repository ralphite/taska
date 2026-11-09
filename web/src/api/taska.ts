// The server's page interface, one typed call each (the server's http/page_routes.py and workspace_routes.py).

import type { Dash } from '../model/dashboard'
import { Http, TIME_LIMIT } from './http'
import type { FindAnswer } from '../model/find'
import type { Command } from '../model/commands'
import type { FileRef, LogRow, Need, NoNews, ProjectRow, Spelling, ViewAnswer, VoicePrefs, WordsAnswer, SavedView } from '../model/types'

export type { Command } from '../model/commands'

export interface CommandAnswer {
  ok: boolean
  results: string[]
  changes?: ViewAnswer
}

/** A project's name for people and its address. */
export interface ProjectAnswer {
  ok: boolean
  name: string
  title: string
}

interface Ok {
  ok: boolean
}

/** What each call gets back, by the call's name: api/samples.gen.ts holds a real answer of each (tools/api_samples.py),
 * checked against these both ways (the type check, web/scripts/check-api.mjs). */
export interface Answers {
  view: ViewAnswer
  changes: ViewAnswer | NoNews
  commands: CommandAnswer
  upload: FileRef & { pending?: boolean }
  moveInput: Ok & { to: string; as: string }
  moveItem: Ok & { as: string; with?: number; docs?: number }
  words: WordsAnswer
  projects: ProjectRow[]
  createProject: ProjectAnswer
  renameProject: ProjectAnswer & { was: string }
  deleteProject: ProjectAnswer
  restoreProject: ProjectAnswer
  purgeProject: Ok & { name: string }
  deletedProjects: { name: string; title: string; t: string; items: number }[]
  orderProjects: Ok
  needs: Need[]
  find: FindAnswer
  restart: Ok
  login: Ok & { error?: string }
  pushKey: { key: string; on: boolean }
  setPush: Ok
  devDashboard: Dash
  views: SavedView[]
  setViews: Ok & { views: SavedView[] }
  corrections: Spelling[]
  setCorrection: Ok & { corrections: Spelling[] }
  voicePrefs: VoicePrefs
  setVoicePrefs: VoicePrefs & Ok
  setTidy: Ok & { tidy: boolean }
  newKey: Ok & { key: string }
  pictureSizes: Record<string, [number, number]>
  activity: LogRow[]
  diagramFailed: Ok & { result: string }
  pageLog: Ok
}

const P = (slug: string) => `/p/${encodeURIComponent(slug)}/api/`

export class TaskaApi {
  readonly http: Http
  constructor(http: Http = new Http()) {
    this.http = http
  }

  view(slug: string, cursor: string | null, signal?: AbortSignal): Promise<Answers['view']> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    return this.http.json(P(slug) + 'view' + q, { timeout: TIME_LIMIT.view, signal })
  }

  /** What changed since the cursor: waits up to `wait` seconds for news. */
  changes(slug: string, cursor: string, wait: number, signal?: AbortSignal): Promise<Answers['changes']> {
    const q = `?cursor=${encodeURIComponent(cursor)}&wait=${wait}`
    return this.http.json(P(slug) + 'changes' + q, { timeout: (wait + 10) * 1000, signal })
  }

  /** Changes, done once per id however often they are sent; with a cursor the answer brings what changed. */
  commands(slug: string, id: string, commands: Command[], cursor: string | null): Promise<Answers['commands']> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    return this.http.json(P(slug) + 'commands' + q, {
      method: 'POST',
      body: { id, commands },
      timeout: TIME_LIMIT.command,
    })
  }

  upload(slug: string, file: Blob, name: string, opts: { voice?: boolean; scope?: string | null } = {}): Promise<Answers['upload']> {
    const q = new URLSearchParams({ name })
    if (opts.voice) q.set('transcribe', '1')
    if (opts.scope) q.set('scope', opts.scope)
    return this.http.json(P(slug) + 'file?' + q.toString(), {
      method: 'POST',
      raw: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      timeout: 120000,
    })
  }

  /** An input sent to the wrong project goes to another one: -> what it is called there. */
  moveInput(slug: string, to: string, id: string): Promise<Answers['moveInput']> {
    return this.http.json(P(slug) + 'move-input', { method: 'POST', body: { id, to }, timeout: TIME_LIMIT.command })
  }

  /** An item (with its subitems, words and talk) goes to another project; done once per id. */
  moveItem(slug: string, to: string, ref: string, id: string, under?: string): Promise<Answers['moveItem']> {
    return this.http.json(P(slug) + 'move-item?id=' + encodeURIComponent(id), { method: 'POST', body: { to, ref, ...(under ? { under } : {}) }, timeout: TIME_LIMIT.command })
  }

  /** A voice note's words: at once when they are kept (GET), or waiting for them (POST; again: a failed one tried
   * once more; more: the final words after its first words came early). */
  words(slug: string, f: string, wait = false, o: { scope?: string | null; again?: boolean; more?: boolean } = {}): Promise<Answers['words']> {
    const q = new URLSearchParams({ f })
    if (o.scope) q.set('scope', o.scope)
    if (o.again) q.set('again', '1')
    if (o.more) q.set('more', '1')
    return this.http.json(P(slug) + 'words?' + q.toString(), wait ? { method: 'POST', timeout: 60000 } : {})
  }

  /** An item's card, word for word what an agent reading it gets (F568); read with ui=1, so it is no agent's visit. */
  card(slug: string, code: string): Promise<string> {
    return this.http.text(`/p/${encodeURIComponent(slug)}/${encodeURIComponent(code)}?ui=1`)
  }

  projects(): Promise<Answers['projects']> {
    return this.http.json('/api/projects')
  }

  /** A new project, any name: its address is made from it. */
  createProject(title: string): Promise<Answers['createProject']> {
    return this.http.json('/api/projects', { method: 'POST', body: { title } })
  }

  renameProject(name: string, title: string): Promise<Answers['renameProject']> {
    return this.http.json('/api/projects/rename', { method: 'POST', body: { name, title } })
  }

  deleteProject(name: string): Promise<Answers['deleteProject']> {
    return this.http.json('/api/projects/delete', { method: 'POST', body: { name } })
  }

  restoreProject(name: string): Promise<Answers['restoreProject']> {
    return this.http.json('/api/projects/restore', { method: 'POST', body: { name } })
  }

  purgeProject(name: string): Promise<Answers['purgeProject']> {
    return this.http.json('/api/projects/purge', { method: 'POST', body: { name } })
  }

  deletedProjects(): Promise<Answers['deletedProjects']> {
    return this.http.json('/api/projects/deleted')
  }

  orderProjects(names: string[]): Promise<Answers['orderProjects']> {
    return this.http.json('/api/projects/order', { method: 'POST', body: { names } })
  }

  needs(): Promise<Answers['needs']> {
    return this.http.json('/api/needs')
  }

  /** The search (F479: Home's, ⌘K, the phone's): what the words find in every project, by meaning and by the words;
   * `here`: the project you are in. */
  find(q: string, here: string): Promise<Answers['find']> {
    return this.http.json(`/api/find?q=${encodeURIComponent(q)}&here=${encodeURIComponent(here)}`, { timeout: 60000 })
  }

  /** What a coding agent reads first (the guide), as the page shows it. */
  guide(slug: string): Promise<string> {
    return this.http.text(`/p/${encodeURIComponent(slug)}/agent?ui=1`)
  }

  /** Taska restarted now (it answers, then stops as a deploy does). */
  restart(): Promise<Answers['restart']> {
    return this.http.json('/api/restart', { method: 'POST', body: {} })
  }

  /** The key, given once on a device reaching Taska from outside this computer's network. */
  login(key: string): Promise<Answers['login']> {
    return this.http.json('/api/login', { method: 'POST', body: { key } })
  }

  /** The phone's pushes: the server's public key; a phone subscribed (with quiet hours) or let go. */
  pushKey(): Promise<Answers['pushKey']> {
    return this.http.json('/api/push')
  }

  setPush(body: { sub?: unknown; quiet?: boolean; from?: string; to?: string; endpoint?: string; off?: boolean }): Promise<Answers['setPush']> {
    return this.http.json('/api/push', { method: 'POST', body })
  }

  /** The dashboard for making Taska (this computer only): `days` 0 today, 7 a week, 'all'. */
  devDashboard(days: string): Promise<Answers['devDashboard']> {
    return this.http.json('/dev/api/dashboard?days=' + encodeURIComponent(days))
  }

  /** Your own views of the item list, the same in every project. */
  views(): Promise<Answers['views']> {
    return this.http.json('/api/views')
  }

  setViews(views: SavedView[]): Promise<Answers['setViews']> {
    return this.http.json('/api/views', { method: 'POST', body: { views } })
  }

  /** Voice spellings: corrections (wrong -> right) and words to hear, for every project. */
  corrections(): Promise<Answers['corrections']> {
    return this.http.json('/api/corrections')
  }

  setCorrection(body: { wrong?: string; right?: string; forget?: boolean; undo?: boolean; project?: string; item?: string; file?: string }): Promise<Answers['setCorrection']> {
    return this.http.json('/api/corrections', { method: 'POST', body })
  }

  /** How voice notes are written down, for every project, and whether they are tidied. */
  voicePrefs(): Promise<Answers['voicePrefs']> {
    return this.http.json('/api/voiceprefs')
  }

  setVoicePrefs(text: string): Promise<Answers['setVoicePrefs']> {
    return this.http.json('/api/voiceprefs', { method: 'POST', body: { text } })
  }

  setTidy(on: boolean): Promise<Answers['setTidy']> {
    return this.http.json('/api/voicetidy', { method: 'POST', body: { on } })
  }

  /** A new key: this device keeps working, every other one needs the new link. */
  newKey(): Promise<Answers['newKey']> {
    return this.http.json('/api/key', { method: 'POST' })
  }

  /** The pictures of the project's files, each with its width and height. */
  pictureSizes(slug: string): Promise<Answers['pictureSizes']> {
    return this.http.json(P(slug) + 'picture-sizes')
  }

  /** The change log, the latest first: the last n changes, or the n before change `before`. */
  activity(slug: string, n: number, before = 0): Promise<Answers['activity']> {
    return this.http.json(P(slug) + `activity?n=${n}` + (before ? `&before=${before}` : ''))
  }

  /** A document's diagram that did not draw (B714 r1181): Taska tells the agent that wrote it, once. */
  diagramFailed(slug: string, body: { d: number; v: number; key: string; error: string }): Promise<Answers['diagramFailed']> {
    return this.http.json(P(slug) + 'diagram-failed', { method: 'POST', body })
  }

  pageLog(slug: string, list: Record<string, unknown>[]): Promise<Answers['pageLog']> {
    return this.http.json(P(slug) + 'page-log', { method: 'POST', body: { list } })
  }
}
