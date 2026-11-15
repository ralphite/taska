// Shared rules (I779): the list (loaded when Settings › Shared rules or a project's Rules shows them, again after a
// change), new ones made by name, one opened (its address is its own, `~<id>`, and its page is the Rules tab's: the
// project you came from is kept, for the way back), and a line put into the rules being edited where the caret is.

import type { Delivery } from '../../api/delivery'
import { Refused } from '../../api/http'
import type { TaskaApi } from '../../api/taska'
import { insertLine, isSharedSlug } from '../../model/includes'
import { REACH_WORDS } from '../../model/reach'
import type { DataStore } from '../../stores/data'
import type { DocViewStore } from '../../stores/docView'
import type { RouteStore } from '../../stores/route'
import type { SettingsStore } from '../../stores/settings'
import type { KeyValueStore } from '../../stores/storage'
import type { Fields } from '../page/fields'
import type { Sheets } from '../page/sheets'
import type { Toasts } from '../page/toasts'

export interface SharedRulesDeps {
  api: TaskaApi
  delivery: Delivery
  store: SettingsStore
  data: DataStore
  route: RouteStore
  view: DocViewStore
  fields: Fields
  sheets: Sheets
  toasts: Toasts
  kv: KeyValueStore
  slug(): string
}

const FROM = 'taska.sharedFrom'

export class SharedRules {
  private readonly d: SharedRulesDeps
  private loading: Promise<void> | null = null
  constructor(d: SharedRulesDeps) {
    this.d = d
  }

  /** The list, asked again (one ask at a time); out of reach, it stays as last seen. */
  load(): Promise<void> {
    this.loading ??= this.d.api
      .sharedRules()
      .then((shared) => this.d.store.getState().set({ shared }))
      .catch(() => undefined)
      .finally(() => (this.loading = null))
    return this.loading
  }

  /** The project a shared rule's page goes back to: the one it was opened from, else the first listed. */
  home(): string {
    const kept = this.d.kv.get(FROM)
    const rows = this.d.data.getState().projects || []
    return kept && (!rows.length || rows.some((p) => p.name === kept)) ? kept : (rows[0]?.name ?? '')
  }

  /** Settings › Shared rules, in the project it came from. */
  listHref(): string {
    const h = this.home()
    return h ? `/p/${encodeURIComponent(h)}/shared` : '/'
  }

  /** One opened: its page, as the Rules tab is a project's. */
  open(slug: string): void {
    const here = this.d.slug()
    if (here && !isSharedSlug(here)) this.d.kv.set(FROM, here)
    this.d.route.getState().go(`/p/${encodeURIComponent(slug)}/rules`, true)
  }

  /** Back to the list. */
  back(): void {
    this.d.route.getState().go(this.listHref(), true)
  }

  /** New shared rules by a name no other has: made, then opened to write. -> why not (none: made) */
  async create(name: string): Promise<string | null> {
    try {
      const r = await this.d.delivery.until(() => this.d.api.newSharedRules(name), { waiting: () => this.d.toasts.show(REACH_WORDS.waits) })
      await this.load()
      this.d.sheets.close(() => this.open(r.slug))
      return null
    } catch (ex) {
      return ex instanceof Refused ? ex.message || 'Not made' : 'Not made'
    }
  }

  /** Insert: the line put in the rules being edited where the caret is, on a line of its own. */
  insert(line: string): void {
    const v = this.d.view.getState()
    const field = this.d.fields.get('doc') as HTMLTextAreaElement | null
    const text = v.text ?? ''
    const at = field ? field.selectionStart : text.length // a field keeps its caret when you press away from it
    const put = insertLine(text, at, line)
    v.setText(put.text)
    this.d.sheets.close()
    requestAnimationFrame(() => {
      const el = this.d.fields.get('doc') as HTMLTextAreaElement | null
      el?.focus()
      el?.setSelectionRange(put.caret, put.caret)
    })
  }
}
