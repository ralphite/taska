// What an agent wrote since you last looked at an item: a blue dot on its row. Kept in this browser per project
// ("taska.seen.<project>": {since, <n>: the time of the agent's last message you saw}).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { KeyValueStore } from './storage'

export type SeenMap = Record<string, string>

export class Seen {
  private maps = new Map<string, SeenMap>()
  private readonly kv: KeyValueStore
  /** counts each change, for what shows the dots to draw again */
  readonly rev: StoreApi<number> = createStore<number>()(() => 0)
  constructor(kv: KeyValueStore) {
    this.kv = kv
  }

  of(slug: string): SeenMap {
    let m = this.maps.get(slug)
    if (!m) {
      m = this.kv.getJson<SeenMap>('taska.seen.' + slug) || { since: new Date().toISOString() }
      if (!this.kv.get('taska.seen.' + slug)) this.kv.setJson('taska.seen.' + slug, m)
      this.maps.set(slug, m)
    }
    return m
  }

  /** A document's paragraph seen up to its last comment's time ("D4:key"). */
  markKey(slug: string, key: string, t: string): void {
    const m = this.of(slug)
    m[key] = t
    this.kv.setJson('taska.seen.' + slug, m)
  }

  /** Seen up to this agent message's time. */
  mark(slug: string, n: number, t: string): void {
    const m = this.of(slug)
    m[n] = t
    this.kv.setJson('taska.seen.' + slug, m)
    this.rev.setState((r) => r + 1)
  }

  /** The item shows: what its agents wrote is seen (its dot goes). */
  see(slug: string, n: number, lastAgentT: string | undefined, archived: boolean): void {
    if (lastAgentT && unreadSince(this.of(slug), n, lastAgentT, archived)) this.mark(slug, n, lastAgentT)
  }
}

export const unreadSince = (map: SeenMap, n: number, lastAgentT: string | undefined, archived: boolean) =>
  !!lastAgentT && !archived && Date.parse(lastAgentT) > Date.parse(map[n] || map.since)
