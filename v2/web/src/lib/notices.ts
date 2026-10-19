// Notifications. On a computer (F191): while Taska is open but not in front, a notification when something newly needs
// you here or in another project. On the phone (F195): Taska on the Home Screen subscribes with the browser's push
// service; Taska then pushes when something newly needs you, and the phone shows what it is (sw.ts).
import { bump, ctx, desk, needsYou, plural, titleOf } from './state'
import { JSON_POST, NET, net } from './data'
import { toast } from './toast'
import type { ProjectRow, State } from './types'

const NOTICE = {
  items: false,
  projects: false,
  pending: new Map<string, NoticeEvent>(),
  timer: 0,
  memory: {} as Record<string, unknown>,
}
interface NoticeEvent {
  project: string
  title: string
  code?: string
  kind?: string
  count: number
}
export function noticeRead<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem('taska.notifications.' + key) as string) as T) ?? fallback
  } catch {
    return (NOTICE.memory[key] as T) ?? fallback
  }
}
export function noticeWrite(key: string, value: unknown) {
  NOTICE.memory[key] = value
  try {
    localStorage.setItem('taska.notifications.' + key, JSON.stringify(value))
  } catch {
    /* no storage */
  }
}
export const noticeOn = () =>
  'Notification' in window && Notification.permission === 'granted' && noticeRead('on', false)
export const noticeState = () =>
  !('Notification' in window) || Notification.permission === 'denied'
    ? 'Blocked by the browser'
    : noticeOn()
      ? 'On'
      : 'Off'
const noticeQuiet = () => noticeRead('quiet', true) && (new Date().getHours() >= 22 || new Date().getHours() < 8)
const noticeAllowed = () => desk() && noticeOn() && (document.hidden || !document.hasFocus()) && !noticeQuiet()
export async function turnOnNotices() {
  if (!desk() || !('Notification' in window)) return
  try {
    noticeWrite('on', (await Notification.requestPermission()) === 'granted')
  } catch {
    /* the browser said no */
  }
  bump('project')
}
function queueNotice(key: string, event: NoticeEvent) {
  if (!noticeAllowed()) return
  const prev = NOTICE.pending.get(key)
  NOTICE.pending.set(key, { ...event, count: event.code ? 1 : event.count + (prev?.count || 0) })
  if (!NOTICE.timer) NOTICE.timer = window.setTimeout(sendNotice, 8000)
}
function sendNotice() {
  const events = [...NOTICE.pending.values()]
  NOTICE.pending.clear()
  NOTICE.timer = 0
  if (!events.length || !noticeAllowed()) return
  const count = events.reduce((n, e) => n + e.count, 0),
    first = events[0]
  const labels = events.map((e) =>
    e.code
      ? `${e.code} ${e.kind === 'ask' ? 'asks' : e.kind === 'block' ? 'is blocked' : e.kind === 'review' ? 'is ready to accept' : 'needs approval'} in ${e.title}`
      : `${plural(e.count, 'new thing')} need${e.count === 1 ? 's' : ''} you in ${e.title}`,
  )
  try {
    const notification = new Notification(
      count === 1
        ? labels[0]
        : `${count} things need you: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? ', …' : ''}`,
      { tag: 'taska-needs-you' },
    )
    notification.onclick = () => {
      notification.close()
      window.focus()
      location.assign(
        `/p/${encodeURIComponent(first.project)}/${count === 1 && first.code ? encodeURIComponent(first.code) : ''}`,
      )
    }
  } catch {
    /* a permission change must not interrupt polling */
  }
}
export function noticeItems(d: State) {
  if (!desk()) return
  const saved = 'items.' + d.project,
    before = noticeRead<Record<string, unknown>>(saved, {}),
    next: Record<string, unknown> = {}
  for (const it of d.items.filter(needsYou)) {
    const kinds = [
      ...(it.wait ? [it.wait.kind] : []),
      ...(['proposed', 'review'].includes(it.status) ? [it.status] : []),
    ]
    let event: NoticeEvent | null = null
    for (const kind of kinds) {
      const key = `${d.project}:${it.code}:${kind}`,
        token = kind === it.wait?.kind ? it.wait.id : kind
      next[key] = token
      if (NOTICE.items && before[key] !== token && !event)
        event = { project: d.project, title: d.title || d.project, code: it.code, kind, count: 1 }
    }
    if (event) queueNotice(`${d.project}:${it.code}`, event)
  }
  for (const [key, e] of NOTICE.pending)
    if (e.project === d.project && e.code && !(`${e.project}:${e.code}:${e.kind}` in next)) NOTICE.pending.delete(key)
  noticeWrite(saved, next)
  NOTICE.items = true
}
export function noticeProjects(projects: ProjectRow[]) {
  if (!desk()) return
  const before = noticeRead<Record<string, number>>('counts', {}),
    next: Record<string, number> = {}
  for (const p of projects) {
    next[p.name] = p.needs
    if (NOTICE.projects && p.name !== ctx.HERE && p.needs > (before[p.name] ?? 0))
      queueNotice(`${p.name}:*:needs`, { project: p.name, title: titleOf(p), count: p.needs - (before[p.name] ?? 0) })
  }
  noticeWrite('counts', next)
  NOTICE.projects = true
}

// ---------------------------------------------------------------- push (the phone)

export const PUSH = { sub: undefined as PushSubscription | null | undefined }
export const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true
export const pushable = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && isSecureContext
const keyBytes = (k: string) =>
  Uint8Array.from(atob(k.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((k.length + 3) % 4)), (c) =>
    c.charCodeAt(0),
  )
export async function pushState() {
  try {
    PUSH.sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
  } catch {
    PUSH.sub = null
  }
  bump('project')
}
export async function pushOn() {
  try {
    if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted')
      return toast("Notifications are off for Taska in this phone's settings", null, { error: true })
    const reg = await navigator.serviceWorker.ready,
      { key } = await net<{ key: string }>('/api/push')
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
    await net('/api/push', JSON_POST({ sub: sub.toJSON(), quiet: noticeRead('quiet', true) }), NET.op)
    if (!PUSH.sub) toast('Notifications are on for this phone')
    PUSH.sub = sub
  } catch (ex) {
    toast(`Couldn't turn notifications on: ${(ex as Error).message || ex}`, null, { error: true })
  }
  bump('project')
}
export async function pushOff() {
  const sub = PUSH.sub
  try {
    if (sub) {
      await net('/api/push', JSON_POST({ endpoint: sub.endpoint, off: true }), NET.op)
      await sub.unsubscribe()
    }
  } catch {
    /* it is off here anyway */
  }
  PUSH.sub = null
  bump('project')
  toast('Notifications are off for this phone')
}
