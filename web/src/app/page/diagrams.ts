// Mermaid diagrams drawn from their words, as Nota draws them. Mermaid is large: it is loaded the first time a diagram
// is shown. Its strict mode cleans the drawing (no scripts, no clicks). Drawings are remembered per words and theme,
// so showing one again does not draw it again; each place gets its own ids. A document's diagram that does not draw
// is told to the server, which tells the agent that wrote it (B714 r1181).

import { isolateSvg, mermaidError } from '../../ui/markdown/mermaid'

type Mermaid = (typeof import('mermaid'))['default']

/** The drawing code itself could not load (no connection, files of a newer version): not the diagram's fault. */
export class DrawerUnavailable extends Error {}

const LOAD_FAILED = /dynamically imported module|importing a module script failed|failed to fetch|loading (css )?chunk|networkerror/i

/** The diagram failed because its drawing code did not load, not because of its words: nobody is told (B714). */
export const loadFailed = (e: unknown) => e instanceof DrawerUnavailable || (e instanceof Error && (e.name === 'ChunkLoadError' || LOAD_FAILED.test(e.message)))

const unavailable = (e: unknown) => new DrawerUnavailable(`The diagram drawer could not load: ${e instanceof Error ? e.message : String(e)}`)

/** A document's diagram that did not draw: which one (the document, its version, the paragraph) and Mermaid's words. */
export interface DiagramFailure {
  d: number
  v: number
  key: string
  error: string
}

export class Diagrams {
  private readonly drawn = new Map<string, string>() // words + theme -> SVG, the last 100
  private loading: Promise<Mermaid> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private configured = ''
  private readonly told = new Set<string>()
  private readonly send?: (slug: string, f: DiagramFailure) => Promise<unknown>

  /** `send`: tells the server of a document's diagram that does not draw (none: nobody is told, as in stories). */
  constructor(send?: (slug: string, f: DiagramFailure) => Promise<unknown>) {
    this.send = send
  }

  /** The diagram's SVG for its words, dark or light; `id`: unique to where it is shown. Rejects with Mermaid's
   * message when the words are not a diagram, with a DrawerUnavailable when Mermaid could not load. */
  draw(src: string, dark: boolean, id: string): Promise<string> {
    const theme = dark ? 'dark' : 'neutral'
    const key = `${theme}\n${src}`
    const hit = this.drawn.get(key)
    if (hit) return Promise.resolve(isolateSvg(hit, id))
    // initialize() changes Mermaid's global settings: drawings go one at a time so a theme can't change mid-draw
    const job = this.queue.then(async () => {
      // not loaded: tried again the next time a diagram is shown
      this.loading ??= import('mermaid').then(
        (m) => m.default,
        (e: unknown) => {
          this.loading = null
          throw unavailable(e)
        },
      )
      const mermaid = await this.loading
      if (this.configured !== theme) {
        // as Nota: classic shapes with ELK routing, pinned so an upgrade can't rearrange a diagram; words that are
        // not a diagram reject (the block says why) instead of leaving Mermaid's error picture on the page
        mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true, securityLevel: 'strict', theme, look: 'classic', layout: 'elk', elk: { nodePlacementStrategy: 'LINEAR_SEGMENTS' }, fontSize: 16, themeVariables: { fontSize: '16px' } })
        this.configured = theme
      }
      // Mermaid loads each kind of diagram's code as it is needed: that failing is not the words' fault either
      const { svg } = await mermaid.render(`${id}-src`, src).catch((e: unknown) => {
        throw loadFailed(e) ? unavailable(e) : e
      })
      if (this.drawn.size >= 100) this.drawn.delete(this.drawn.keys().next().value as string)
      this.drawn.set(key, svg)
      return svg
    })
    this.queue = job.catch(() => {})
    return job.then((svg) => isolateSvg(svg, id))
  }

  /** A document's diagram did not draw (`e`: why): the server hears it once from this page for each version,
   * paragraph and reason (it tells the writer once, however many pages tell it). Not when Mermaid did not load. */
  failed(slug: string, at: Omit<DiagramFailure, 'error'>, e: unknown): void {
    if (!this.send || loadFailed(e)) return
    const error = mermaidError(e)
    const id = [slug, at.d, at.v, at.key, error].join('\n')
    if (this.told.has(id)) return
    this.told.add(id)
    void this.send(slug, { ...at, error }).catch(() => this.told.delete(id)) // not heard: told the next time it is shown
  }
}
