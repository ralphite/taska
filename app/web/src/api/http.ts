// Talking to the Taska server: every request has a time limit, so a dead connection fails after a while instead of
// hanging; the three ways a request can fail are told apart (unreachable, the key is needed, the server said no).

export const TIME_LIMIT = { command: 10000, view: 30000, read: 15000 } // ms

/** The server could not be reached, or did not answer in time: worth sending again. */
export class Unreachable extends Error {
  readonly timedOut: boolean
  constructor(timedOut: boolean) {
    super(timedOut ? 'No answer from Taska' : 'Taska is unreachable')
    this.timedOut = timedOut
  }
}

/** The server wants its key (from outside this machine). */
export class KeyNeeded extends Error {
  constructor() {
    super('key')
  }
}

/** The server answered no, with its reason. Sending it again would not help. */
export class Refused extends Error {}

/** The request was stopped on purpose (the page moved on). */
export class Abandoned extends Error {}

export interface Request {
  method?: 'GET' | 'POST'
  body?: unknown
  raw?: BodyInit
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
}

export type Transport = (url: string, init: RequestInit) => Promise<Response>

export class Http {
  private readonly transport: Transport
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
      res = await this.transport(url, { method: req.method || 'GET', headers, body, cache: 'no-store', signal: ctl.signal })
    } catch {
      if (outer?.aborted) throw new Abandoned()
      throw new Unreachable(ctl.signal.aborted)
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
      if (res.status >= 500) throw new Unreachable(false)
      throw new Refused(why || 'Taska said no')
    }
    return text
  }
}
