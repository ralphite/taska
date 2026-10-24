// What Settings does: it loads what it shows (the guide agents read, voice spellings and preferences, the deleted
// projects) and changes it: projects made, renamed, deleted, restored or deleted for good; spellings added and
// forgotten (with Undo); voice notes tidied or not; the transcription preferences edited in the box; a new key.

import { Refused } from '../api/http'
import type { TaskaApi } from '../api/taska'
import type { Spelling } from '../model/types'
import type { BoxStore } from '../stores/box'
import type { DataStore } from '../stores/data'
import type { RouteStore } from '../stores/route'
import type { SettingsStore } from '../stores/settings'
import type { Box } from './box'
import { copyText } from './clipboard'
import type { Fields } from './fields'
import type { Projects } from './projects'
import type { Sheets } from './sheets'
import type { Toasts } from './toasts'

export interface SettingsDeps {
  api: TaskaApi
  store: SettingsStore
  data: DataStore
  projects: Projects
  route: RouteStore
  sheets: Sheets
  toasts: Toasts
  box: Box
  boxStore: BoxStore
  fields: Fields
  refresh(slug: string): void
}

const why = (ex: unknown, no = 'Not saved') => (ex instanceof Refused ? ex.message || no : 'Connection lost; try again')

export class Settings {
  private readonly d: SettingsDeps
  constructor(d: SettingsDeps) {
    this.d = d
  }

  private get s() {
    return this.d.store.getState()
  }

  async loadGuide(slug: string): Promise<void> {
    if (this.s.guide?.slug === slug) return
    try {
      const text = await this.d.api.guide(slug)
      this.s.set({ guide: { slug, text } })
    } catch {
      /* it says Loading… until it comes */
    }
  }

  async loadSpellings(): Promise<void> {
    try {
      const [fixes, prefs] = await Promise.all([this.d.api.corrections(), this.d.api.voicePrefs()])
      this.s.set({ fixes, prefs })
    } catch {
      this.d.toasts.show("Couldn't load the voice spellings. Loads when Taska is back", null, { error: true })
    }
  }

  async loadProjects(): Promise<void> {
    try {
      const [, deleted] = await Promise.all([this.d.projects.refresh(), this.d.api.deletedProjects()])
      this.s.set({ deleted })
    } catch {
      /* the list stays as last seen */
    }
  }

  copy(text: string): void {
    void copyText(text).then(() => this.d.toasts.show('Copied'))
  }

  // ---- projects

  newProject(on: boolean): void {
    this.s.set({ pNew: on, pNewText: on ? this.s.pNewText : '', pErr: '', renaming: null, pMenu: null })
  }

  async create(title: string): Promise<void> {
    const t = title.trim()
    if (!t) return
    const r = await this.d.projects.create(t)
    if ('name' in r) {
      this.s.set({ pNew: false, pNewText: '', pErr: '' })
      return this.d.route.getState().go(`/p/${encodeURIComponent(r.name)}/`, true)
    }
    this.s.set({ pErr: r.error, pNewText: t })
  }

  rename(slug: string | null): void {
    this.s.set({ renaming: slug, pNew: false, pMenu: null })
  }

  async saveRename(slug: string, title: string, was: string): Promise<void> {
    const t = title.trim()
    this.s.set({ renaming: null })
    if (!t || t === was) return
    const r = await this.d.projects.rename(slug, t)
    if ('error' in r) {
      this.s.set({ renaming: slug })
      return this.d.toasts.show(r.error)
    }
    this.d.refresh(slug)
    this.d.toasts.show(`Renamed to ${t}`, async () => {
      const back = await this.d.projects.rename(slug, was)
      if ('error' in back) return this.d.toasts.show(back.error)
      this.d.refresh(slug)
      this.d.toasts.show(`Back to ${was}`)
    })
  }

  /** Deleted: it leaves the sidebar; the open one goes on to another project, whose Projects offers it back. */
  async remove(slug: string, here: string): Promise<void> {
    this.s.set({ pMenu: null })
    const r = await this.d.projects.remove(slug)
    if ('error' in r) return this.d.toasts.show(r.error)
    if (slug === here) {
      const rows = (this.d.data.getState().projects || []).filter((p) => p.name !== slug).sort((a, b) => (b.t || 0) - (a.t || 0))
      return this.d.route.getState().go(rows[0] ? `/p/${encodeURIComponent(rows[0].name)}/projects` : '/', true)
    }
    await this.loadProjects()
  }

  async restore(slug: string): Promise<void> {
    const r = await this.d.projects.restore(slug)
    if ('error' in r) return this.d.toasts.show(r.error)
    this.s.set({ pMenu: null })
    await this.loadProjects()
    this.d.toasts.show(`${r.title} is back`)
  }

  /** For good (a second press within 3 seconds): the only step that cannot be undone. */
  async purge(slug: string): Promise<void> {
    if (!this.d.sheets.confirm('purge ' + slug)) return
    try {
      await this.d.api.purgeProject(slug)
      this.s.set({ pMenu: null })
      await this.loadProjects()
      this.d.toasts.show('Deleted for good')
    } catch (ex) {
      this.d.toasts.show(why(ex))
    }
  }

  menu(key: string): void {
    this.s.set({ pMenu: this.s.pMenu === key ? null : key, renaming: null })
  }

  // ---- voice

  private async spell(body: { wrong?: string; right?: string; forget?: boolean }): Promise<boolean> {
    try {
      const d = await this.d.api.setCorrection(body)
      this.s.set({ fixes: d.corrections })
      return true
    } catch (ex) {
      this.d.toasts.show(why(ex), null, { error: true })
      return false
    }
  }

  async addWord(right: string): Promise<boolean> {
    const w = right.trim()
    if (!w) return false
    const ok = await this.spell({ right: w })
    if (ok) this.d.toasts.show(`Voice notes will hear “${w}”`)
    return ok
  }

  async forget(c: Spelling): Promise<void> {
    if (!c.wrong) {
      if (await this.spell({ right: c.right, forget: true })) this.d.toasts.show(`Forgot “${c.right}”`, () => this.spell({ right: c.right }))
      return
    }
    const wrong = c.wrong
    if (await this.spell({ wrong })) this.d.toasts.show(`Forgot “${wrong}”`, () => this.spell({ wrong, right: c.right }))
  }

  async toggleTidy(): Promise<void> {
    try {
      const r = await this.d.api.setTidy(!this.s.prefs?.tidy)
      if (this.s.prefs) this.s.set({ prefs: { ...this.s.prefs, tidy: r.tidy } })
      this.d.toasts.show(r.tidy ? 'Voice notes are tidied' : 'Voice notes are kept word for word')
    } catch (ex) {
      this.d.toasts.show(why(ex), null, { error: true })
    }
  }

  /** The preferences in the box, to edit; Save keeps them for every project. */
  editPrefs(slug: string): void {
    const pr = this.s.prefs
    if (!pr) return
    this.d.boxStore.getState().setMode({ kind: 'prefs', was: pr.text })
    if (!this.d.box.text(slug, 'prefs').trim()) this.d.box.write(slug, 'prefs', pr.text)
    requestAnimationFrame(() => this.d.fields.focus('box'))
  }

  async savePrefs(slug: string): Promise<void> {
    const text = this.d.box.text(slug, 'prefs').trim()
    const mode = this.d.boxStore.getState().mode
    const was = mode?.kind === 'prefs' ? mode.was : ''
    if (!text) return this.d.toasts.show('Enter transcription rules, or press Esc to cancel')
    try {
      const d = await this.d.api.setVoicePrefs(text)
      this.s.set({ prefs: d })
      this.d.boxStore.getState().setMode(null)
      this.d.box.take(slug, 'prefs')
      this.d.toasts.show('Saved: applies to all projects', async () => {
        const back = await this.d.api.setVoicePrefs(was)
        this.s.set({ prefs: back })
      })
    } catch {
      this.d.toasts.show('Connection lost. Your words are still in the box; try again.', null, { error: true })
    }
  }

  // ---- the phone's key

  async newKey(slug: string): Promise<void> {
    if (!this.d.sheets.confirm('new-key')) return
    try {
      await this.d.api.newKey()
    } catch (ex) {
      return this.d.toasts.show(why(ex), null, { error: true })
    }
    this.d.refresh(slug)
    this.d.toasts.show('New key made')
  }
}
