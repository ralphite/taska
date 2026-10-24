// The server's page interface, one typed call each (the server's http/page_routes.py and workspace_routes.py).

import { Http, TIME_LIMIT } from './http'
import type { FileRef, Need, ProjectRow, SearchHit, ViewAnswer } from '../model/types'

/** A change the page asks for: the same commands agents write, as data ({op: "set", ref: "B03", f: {...}}). */
export type Command = Record<string, unknown> & { op: string }

export interface CommandAnswer {
  ok: boolean
  results: string[]
  changes?: ViewAnswer
}

const P = (slug: string) => `/p/${encodeURIComponent(slug)}/api/`

export class TaskaApi {
  readonly http: Http
  constructor(http: Http = new Http()) {
    this.http = http
  }

  view(slug: string, cursor: string | null, signal?: AbortSignal): Promise<ViewAnswer> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    return this.http.json<ViewAnswer>(P(slug) + 'view' + q, { timeout: TIME_LIMIT.view, signal })
  }

  /** What changed since the cursor: waits up to `wait` seconds for news. */
  changes(slug: string, cursor: string, wait: number, signal?: AbortSignal): Promise<ViewAnswer> {
    const q = `?cursor=${encodeURIComponent(cursor)}&wait=${wait}`
    return this.http.json<ViewAnswer>(P(slug) + 'changes' + q, { timeout: (wait + 10) * 1000, signal })
  }

  /** Changes, done once per id however often they are sent; with a cursor the answer brings what changed. */
  commands(slug: string, id: string, commands: Command[], cursor: string | null): Promise<CommandAnswer> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    return this.http.json<CommandAnswer>(P(slug) + 'commands' + q, {
      method: 'POST',
      body: { id, commands },
      timeout: TIME_LIMIT.command,
    })
  }

  upload(slug: string, file: Blob, name: string, opts: { voice?: boolean; scope?: string | null } = {}): Promise<FileRef & { pending?: boolean }> {
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
  moveInput(slug: string, to: string, id: string): Promise<{ ok: boolean; to: string; as: string }> {
    return this.http.json(P(slug) + 'move-input', { method: 'POST', body: { id, to }, timeout: TIME_LIMIT.command })
  }

  /** An item (with its subitems, words and talk) goes to another project; done once per id. */
  moveItem(slug: string, to: string, ref: string, id: string, under?: string): Promise<{ ok: boolean; as: string; with?: number; docs?: number }> {
    return this.http.json(P(slug) + 'move-item?id=' + encodeURIComponent(id), { method: 'POST', body: { to, ref, ...(under ? { under } : {}) }, timeout: TIME_LIMIT.command })
  }

  /** A voice note's words: at once when they are kept (GET), or waiting for them (POST). */
  words(slug: string, f: string, wait = false): Promise<{ ok?: boolean; tr?: string; heard?: string; error?: string }> {
    return this.http.json(P(slug) + 'words?f=' + encodeURIComponent(f), wait ? { method: 'POST', timeout: 60000 } : {})
  }

  projects(): Promise<ProjectRow[]> {
    return this.http.json<ProjectRow[]>('/api/projects')
  }

  needs(): Promise<Need[]> {
    return this.http.json<Need[]>('/api/needs')
  }

  search(q: string, skip: string): Promise<SearchHit[]> {
    return this.http.json<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}&skip=${encodeURIComponent(skip)}`)
  }

  pageLog(slug: string, list: Record<string, unknown>[]): Promise<unknown> {
    return this.http.json(P(slug) + 'page-log', { method: 'POST', body: { list } })
  }
}
