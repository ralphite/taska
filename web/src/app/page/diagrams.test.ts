// T714 r1181 (Yadong's choice): a document's diagram that does not draw is told to the server, which tells the agent
// that wrote it; once from a page for each version, paragraph and reason, and never when the page could not load the
// drawing code itself (that is not the diagram's fault). Taska's note on the task is no agent's word for you to read.

import { describe, expect, test } from 'vitest'
import { task, message } from '../../stories/fixtures'
import { lastAgentMessage, workNews } from '../../model/tasks'
import { Diagrams, DrawerUnavailable, loadFailed, RETRY_MS, type DiagramFailure } from './diagrams'

const told = () => {
  const sent: [string, DiagramFailure][] = []
  const diagrams = new Diagrams((slug, f) => (sent.push([slug, f]), Promise.resolve({ ok: true })))
  return { sent, diagrams }
}
const at = { d: 126, v: 2, key: 'a1b2c3d4e5' }
const syntax = new Error("Parse error on line 2:\n...A[Start (now)] --> B\n-----------^\nExpecting 'SQE', got 'PS'")

describe('a diagram that does not draw goes to its writer (T714 r1181)', () => {
  test("Mermaid's words, once per version, paragraph and reason", () => {
    const { sent, diagrams } = told()
    diagrams.failed('taska', at, syntax)
    diagrams.failed('taska', at, syntax) // shown again, in another place of the page: not again
    expect(sent).toEqual([['taska', { ...at, error: syntax.message }]])
    diagrams.failed('taska', { ...at, v: 3 }, syntax) // its next version
    diagrams.failed('taska', { ...at, key: 'ffffffffff' }, syntax) // another paragraph
    diagrams.failed('taska', at, new Error('No diagram type detected.')) // another reason
    expect(sent).toHaveLength(4)
  })

  test('not when the drawing code could not load', () => {
    const { sent, diagrams } = told()
    for (const e of [
      new DrawerUnavailable('The diagram drawer could not load'),
      new TypeError('Failed to fetch dynamically imported module: https://taska.local/assets/flowDiagram-x.js'),
      new TypeError('Importing a module script failed.'),
      new TypeError('error loading dynamically imported module'),
    ]) {
      expect(loadFailed(e)).toBe(true)
      diagrams.failed('taska', at, e)
    }
    expect(sent).toEqual([])
    expect(loadFailed(syntax)).toBe(false)
  })

  test('not heard by the server: told the next time it is shown', async () => {
    let fail = true
    const sent: DiagramFailure[] = []
    const diagrams = new Diagrams((_, f) => (sent.push(f), fail ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true })))
    diagrams.failed('taska', at, syntax)
    await new Promise((r) => setTimeout(r, 0))
    fail = false
    diagrams.failed('taska', at, syntax)
    diagrams.failed('taska', at, syntax)
    expect(sent).toHaveLength(2)
  })

  test("Taska's note is no agent's word: the row's news and unread go by the agent's", () => {
    const T = Date.parse('2026-11-07T12:00:00Z')
    const agent = message({ id: 1, text: 'Drew the flow.', t: new Date(T - 60e3).toISOString() })
    const note = message({ id: 2, by: 'taska', text: 'D126 ¶3: this diagram does not draw: No diagram type detected. Fix it.', t: new Date(T).toISOString(), to: ['writer-1'] })
    const it = task({ n: 1, status: 'doing', thread: [agent, note] })
    expect(lastAgentMessage(it)?.id).toBe(1)
    expect(workNews(it, T)?.text).toBe('Drew the flow.')
  })
})

// T836: the phone back on the page before its connection: the drawing code that did not load is tried again by
// itself while the block shows it drawing, instead of the block saying it could not load until the page reloads.
describe('the drawing code not loading is tried again (T836)', () => {
  const offline = () => new TypeError('Importing a module script failed.')
  const mermaid = (render: (src: string) => Promise<{ svg: string }>) => ({ default: { initialize: () => {}, render: (_: string, src: string) => render(src) } }) as never

  test('it draws once the code loads, after the tries that failed', async () => {
    let tries = 0
    const waited: number[] = []
    const d = new Diagrams(undefined, {
      load: () => (++tries < 3 ? Promise.reject(offline()) : Promise.resolve(mermaid(async () => ({ svg: '<svg id="x"></svg>' })))),
      wait: async (ms) => void waited.push(ms),
    })
    await expect(d.draw('flowchart TB\n A --> B', false, 'b1')).resolves.toContain('<svg')
    expect(tries).toBe(3)
    expect(waited).toEqual(RETRY_MS.slice(0, 2))
  })

  test('words that are not a diagram fail at once', async () => {
    let tries = 0
    const d = new Diagrams(undefined, { load: async () => mermaid(() => (tries++, Promise.reject(syntax))), wait: async () => {} })
    await expect(d.draw('flowchart TB\n A[(x) --> B', false, 'b2')).rejects.toBe(syntax)
    expect(tries).toBe(1)
  })

  test('code that never loads: the block says so once every try has failed', async () => {
    let tries = 0
    const d = new Diagrams(undefined, { load: () => (tries++, Promise.reject(offline())), wait: async () => {} })
    await expect(d.draw('flowchart TB\n A --> B', false, 'b3')).rejects.toBeInstanceOf(DrawerUnavailable)
    expect(tries).toBe(RETRY_MS.length + 1)
  })
})
