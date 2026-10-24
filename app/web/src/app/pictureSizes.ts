// Each picture's width and height, from Taska, so a picture in a text keeps its place before it loads and the words
// around it do not jump: asked for when a project opens, and again (at most every few seconds) when its texts show a
// picture whose size is not known yet (one just uploaded). Without them pictures load as before.

import type { TaskaApi } from '../api/taska'
import type { ProjectModel } from '../model/project'
import type { DataStore } from '../stores/data'
import { picturesIn } from '../ui/markdown/inline'

export class PictureSizes {
  private readonly d: { api: TaskaApi; data: DataStore }
  private at = 0
  private timer = 0
  private gen = 0
  constructor(d: PictureSizes['d']) {
    this.d = d
  }

  async load(slug: string): Promise<void> {
    const gen = ++this.gen
    this.at = Date.now()
    try {
      const got = await this.d.api.pictureSizes(slug)
      if (gen === this.gen) this.d.data.getState().setSizes(slug, got)
    } catch {
      /* without sizes pictures load as before */
    }
  }

  /** The project's texts as they are now: a picture of unknown size in them asks again. */
  check(slug: string, m: ProjectModel): void {
    if (this.timer) return
    const known = this.d.data.getState().sizes[slug] || {}
    const texts = [...m.items.flatMap((it) => [it.body, ...it.thread.map((x) => x.text)]), ...m.docs.map((x) => x.md), ...m.inputs.map((r) => r.text)]
    if (!texts.some((t) => t && t.includes('](') && picturesIn(t).some((f) => !known[f]))) return
    this.timer = window.setTimeout(() => {
      this.timer = 0
      void this.load(slug)
    }, Math.max(300, 5000 - (Date.now() - this.at)))
  }
}
