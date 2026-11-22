// Talking to the Taska server: every request has a time limit, so a dead connection fails after a while instead of
// hanging; the three ways a request can fail are told apart (unreachable, the key is needed, the server said no).

export const TIME_LIMIT = { command: 10000, view: 30000, read: 15000 } // ms

/** The server could not be reached, or did not answer in time: worth sending again. */
export class Unreachable extends Error {
  readonly timedOut: boolean
  /** the server's answer, when it gave one (it failed) */
  readonly status?: number
  /** the browser's own words, when nothing came back */
  readonly detail?: string
  constructor(timedOut: boolean, status?: number, detail?: string) {
    super(timedOut ? 'No answer from Taska' : 'Taska is unreachable')
    this.timedOut = timedOut
    this.status = status
    this.detail = detail
  }
}

/** The server wants its key (from outside this machine). */
export class KeyNeeded extends Error {
  constructor() {
    super('key')
  }
}

/** The server answered no, with its reason. Sending it again would not help. */
export class Refused extends Error {
  readonly status?: number
  constructor(why: string, status?: number) {
    super(why)
    this.status = status
  }
}

/** The request was stopped on purpose (the page moved on). */
export class Abandoned extends Error {}

export interface Request {
  method?: 'GET' | 'POST'
  body?: unknown
  raw?: BodyInit
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  /** an answer that never changes under its address (a version of a document): the browser may keep it */
  cache?: boolean
  /** sent as the page goes: it outlives the page */
  keepalive?: boolean
}

/** A request as it ended, for the page's log (T791): its answer's status (none when it never came), and the reason a
 * refused or failed one gave. */
export interface Watched {
  method: string
  url: string
  ms: number
  ok: boolean
  status?: number
  why?: string
}

export type Transport = (url: string, init: RequestInit) => Promise<Response>

export class Http {
  private readonly transport: Transport
  /** told of each request as it ends (the page's log) */
  watch?: (w: Watched) => void
  constructor(transport: Transport = (u, i) => fetch(u, i)) {
    this.transport = transport
  }

  async json<T>(url: string, req: Request = {}): Promise<T> {
    const text = await this.text(url, req)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Unreachable(false)
    }
  }

  async text(url: string, req: Request = {}): Promise<string> {
    const t0 = Date.now()
    const method = req.method || 'GET'
    try {
      const text = await this.ask(url, req)
      this.watch?.({ method, url, ms: Date.now() - t0, ok: true, status: 200 })
      return text
    } catch (ex) {
      if (!(ex instanceof Abandoned))
        this.watch?.({ method, url, ms: Date.now() - t0, ok: false, status: (ex as Refused | Unreachable).status ?? (ex instanceof KeyNeeded ? 401 : undefined), why: ex instanceof Unreachable && !ex.status ? ex.detail || ex.message : (ex as Error).message })
      throw ex
    }
  }

  private async ask(url: string, req: Request): Promise<string> {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), req.timeout ?? TIME_LIMIT.read)
    const outer = req.signal
    if (outer?.aborted) throw new Abandoned()
    const stop = () => ctl.abort()
    outer?.addEventListener('abort', stop)
    const headers: Record<string, string> = { ...req.headers }
    let body: BodyInit | undefined = req.raw
    if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(req.body)
    }
    let res: Response
    try {
      res = await this.transport(url, { method: req.method || 'GET', headers, body, cache: req.cache ? 'default' : 'no-store', signal: ctl.signal, ...(req.keepalive ? { keepalive: true } : {}) })
    } catch (ex) {
      if (outer?.aborted) throw new Abandoned()
      throw new Unreachable(ctl.signal.aborted, undefined, ex instanceof Error ? ex.message : undefined)
    } finally {
      clearTimeout(timer)
      outer?.removeEventListener('abort', stop)
    }
    if (res.status === 401) throw new KeyNeeded()
    let text: string
    try {
      text = await res.text()
    } catch {
      throw new Unreachable(false)
    }
    if (res.status >= 400) {
      let why = text.trim()
      try {
        const d = JSON.parse(text) as { error?: string; results?: string[] }
        why = d.error || (d.results || []).find((x) => x.startsWith('err'))?.replace(/^err[^:]*:\s*/, '') || why
      } catch {
        /* plain text */
      }
      if (res.status >= 500) throw new Unreachable(false, res.status)
      throw new Refused(why || 'Taska said no', res.status)
    }
    return text
  }
}
