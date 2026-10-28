// Notifications. On a computer: whether this browser shows them (asked once), and quiet hours (22:00–08:00, local
// time), kept in this browser; while Taska is open but not in front, a notification when something newly needs you
// here or in another project (what came within 8 s, in one). On the phone: Taska on the Home Screen subscribes with
// the browser's push service; Taska then pushes when something newly needs you, and the phone shows what it is (sw.ts).

import type { TaskaApi } from '../../api/taska'
import { needsYou } from '../../model/items'
import { codeOf, type ProjectModel } from '../../model/project'
import type { ProjectRow } from '../../model/types'
import { plural } from '../../model/words'
import type { DataStore } from '../../stores/data'
import type { KeyValueStore } from '../../stores/storage'
import type { Toasts } from '../page/toasts'

interface Ev {
  project: string
  title: string
  code?: string
  kind?: string
  count: number
}

export interface NoticesDeps {
  api: TaskaApi
  toasts: Toasts
  data: DataStore
  /** the project shown (none: '') */
  slug(): string
  desk(): boolean
  go(url: string): void
}

export type NoticeState = 'On' | 'Off' | 'Blocked by the browser'

export class Notices {
  private readonly kv: KeyValueStore
  private readonly changed: () => void
  private readonly d: NoticesDeps | null
  private seenItems = false
  private seenProjects = false
  private readonly pending = new Map<string, Ev>()
  private timer = 0
  /** the phone's push subscription (undefined: not asked yet) */
  sub: PushSubscription | null | undefined = undefined
  readonly stop: () => void = () => {}
  constructor(kv: KeyValueStore, changed: () => void, d: NoticesDeps | null = null) {
    this.kv = kv
    this.changed = changed
    this.d = d
    // the projects listed again: what newly needs you in the others
    if (d)
      this.stop = d.data.subscribe((s, was) => {
        if (s.projects && s.projects !== was.projects) this.projects(s.projects, d.slug())
      })
  }

  private read<T>(key: string, fallback: T): T {
    return this.kv.getJson<T>('taska.notifications.' + key) ?? fallback
  }

  on(): boolean {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted' && this.read('on', false)
  }

  state(): NoticeState {
    return typeof Notification === 'undefined' || Notification.permission === 'denied' ? 'Blocked by the browser' : this.on() ? 'On' : 'Off'
  }

  quiet(): boolean {
    return this.read('quiet', true)
  }

  setQuiet(on: boolean): void {
    this.kv.setJson('taska.notifications.quiet', on)
    this.changed()
    if (!this.d?.desk() && this.sub) void this.pushOn() // the phone's quiet hours are the server's to keep
  }

  async turnOn(): Promise<void> {
    if (typeof Notification === 'undefined') return
    try {
      this.kv.setJson('taska.notifications.on', (await Notification.requestPermission()) === 'granted')
    } catch {
      /* the browser said no */
    }
    this.changed()
  }

  private quietNow(): boolean {
    const h = new Date().getHours()
    return this.quiet() && (h >= 22 || h < 8)
  }

  private allowed(): boolean {
    return !!this.d?.desk() && this.on() && (document.hidden || !document.hasFocus()) && !this.quietNow()
  }

  private queue(key: string, e: Ev): void {
    if (!this.allowed()) return
    const was = this.pending.get(key)
    this.pending.set(key, { ...e, count: e.code ? 1 : e.count + (was?.count || 0) })
    if (!this.timer) this.timer = window.setTimeout(() => this.send(), 8000)
  }

  private send(): void {
    const events = [...this.pending.values()]
    this.pending.clear()
    this.timer = 0
    if (!events.length || !this.allowed()) return
    const count = events.reduce((n, e) => n + e.count, 0)
    const first = events[0]
    const labels = events.map((e) =>
      e.code
        ? `${e.code} ${e.kind === 'ask' ? 'asks' : e.kind === 'block' ? 'is blocked' : e.kind === 'review' ? 'is ready to accept' : 'needs approval'} in ${e.title}`
        : `${plural(e.count, 'new thing')} need${e.count === 1 ? 's' : ''} you in ${e.title}`,
    )
    try {
      const n = new Notification(count === 1 ? labels[0] : `${count} things need you: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? ', …' : ''}`, { tag: 'taska-needs-you' })
      n.onclick = () => {
        n.close()
        window.focus()
        this.d?.go(`/p/${encodeURIComponent(first.project)}/${count === 1 && first.code ? encodeURIComponent(first.code) : ''}`)
      }
    } catch {
      /* a permission change must not stop the news */
    }
  }

  /** A project shown for the first time tells nothing about what was already waiting, as a fresh page. */
  fresh(): void {
    this.seenItems = false
  }

  /** A project's news: what newly needs you there. */
  items(slug: string, m: ProjectModel): void {
    if (!this.d?.desk()) return
    const saved = 'items.' + slug
    const before = this.read<Record<string, unknown>>(saved, {})
    const next: Record<string, unknown> = {}
    const title = m.facts.title || slug
    for (const it of m.items.filter(needsYou)) {
      const code = codeOf(m, it.n)
      const kinds = [...(it.wait ? [it.wait.kind] : []), ...(['proposed', 'review'].includes(it.status) ? [it.status] : [])]
      let e: Ev | null = null
      for (const kind of kinds) {
        const key = `${slug}:${code}:${kind}`
        const token = kind === it.wait?.kind ? it.wait.id : kind
        next[key] = token
        if (this.seenItems && before[key] !== token && !e) e = { project: slug, title, code, kind, count: 1 }
      }
      if (e) this.queue(`${slug}:${code}`, e)
    }
    for (const [key, e] of this.pending) if (e.project === slug && e.code && !(`${e.project}:${e.code}:${e.kind}` in next)) this.pending.delete(key)
    this.kv.setJson('taska.notifications.' + saved, next)
    this.seenItems = true
  }

  /** The projects listed again: how many need you in the others. */
  projects(rows: readonly ProjectRow[], here: string): void {
    if (!this.d?.desk()) return
    const before = this.read<Record<string, number>>('counts', {})
    const next: Record<string, number> = {}
    for (const p of rows) {
      next[p.name] = p.needs
      if (this.seenProjects && p.name !== here && p.needs > (before[p.name] ?? 0)) this.queue(`${p.name}:*:needs`, { project: p.name, title: p.title || p.name, count: p.needs - (before[p.name] ?? 0) })
    }
    this.kv.setJson('taska.notifications.counts', next)
    this.seenProjects = true
  }

  // ---- the phone's pushes

  static pushable(): boolean {
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window && window.isSecureContext
  }

  async pushState(): Promise<void> {
    try {
      this.sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
    } catch {
      this.sub = null
    }
    this.changed()
  }

  async pushOn(): Promise<void> {
    try {
      if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return this.d?.toasts.show("Notifications are off for Taska in this phone's settings", null, { error: true })
      const reg = await navigator.serviceWorker.ready
      const { key } = (await this.d?.api.pushKey()) || { key: '' }
      const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((key.length + 3) % 4)), (c) => c.charCodeAt(0))
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }))
      await this.d?.api.setPush({ sub: sub.toJSON(), quiet: this.quiet() })
      if (!this.sub) this.d?.toasts.show('Notifications are on')
      this.sub = sub
    } catch (ex) {
      this.d?.toasts.show(`Couldn't turn notifications on: ${(ex as Error).message || ex}`, null, { error: true })
    }
    this.changed()
  }

  async pushOff(): Promise<void> {
    const sub = this.sub
    try {
      if (sub) {
        await this.d?.api.setPush({ endpoint: sub.endpoint, off: true })
        await sub.unsubscribe()
      }
    } catch {
      /* it is off here anyway */
    }
    this.sub = null
    this.changed()
    this.d?.toasts.show('Notifications off for this phone')
  }
}
