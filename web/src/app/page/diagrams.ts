// Mermaid diagrams drawn from their words, as Nota draws them. Mermaid is large: it is loaded the first time a diagram
// is shown. Its strict mode cleans the drawing (no scripts, no clicks). Drawings are remembered per words and theme,
// so showing one again does not draw it again; each place gets its own ids.

import { isolateSvg } from '../../ui/markdown/mermaid'

type Mermaid = (typeof import('mermaid'))['default']

export class Diagrams {
  private readonly drawn = new Map<string, string>() // words + theme -> SVG, the last 100
  private loading: Promise<Mermaid> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private configured = ''

  /** The diagram's SVG for its words, dark or light; `id`: unique to where it is shown. Rejects with Mermaid's
   * message when the words are not a diagram. */
  draw(src: string, dark: boolean, id: string): Promise<string> {
    const theme = dark ? 'dark' : 'neutral'
    const key = `${theme}\n${src}`
    const hit = this.drawn.get(key)
    if (hit) return Promise.resolve(isolateSvg(hit, id))
    // initialize() changes Mermaid's global settings: drawings go one at a time so a theme can't change mid-draw
    const job = this.queue.then(async () => {
      // a failed load is not kept: the next diagram tries again (B714 r1179)
      this.loading ??= import('mermaid').then((m) => m.default).catch((e: unknown) => {
        this.loading = null
        throw e
      })
      const mermaid = await this.loading
      if (this.configured !== theme) {
        // as Nota: classic shapes with ELK routing, pinned so an upgrade can't rearrange a diagram; words that are
        // not a diagram reject (the block says why) instead of leaving Mermaid's error picture on the page
        mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true, securityLevel: 'strict', theme, look: 'classic', layout: 'elk', elk: { nodePlacementStrategy: 'LINEAR_SEGMENTS' }, fontSize: 16, themeVariables: { fontSize: '16px' } })
        this.configured = theme
      }
      const { svg } = await mermaid.render(`${id}-src`, src)
      if (this.drawn.size >= 100) this.drawn.delete(this.drawn.keys().next().value as string)
      this.drawn.set(key, svg)
      return svg
    })
    this.queue = job.catch(() => {})
    return job.then((svg) => isolateSvg(svg, id))
  }
}
