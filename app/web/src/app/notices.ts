// Notifications on a computer: whether this browser shows them (asked once), and quiet hours (22:00–08:00, local
// time), kept in this browser.

import type { KeyValueStore } from '../stores/storage'

export type NoticeState = 'On' | 'Off' | 'Blocked by the browser'

export class Notices {
  private readonly kv: KeyValueStore
  private readonly changed: () => void
  constructor(kv: KeyValueStore, changed: () => void) {
    this.kv = kv
    this.changed = changed
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
}
