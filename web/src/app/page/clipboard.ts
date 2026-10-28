// Copying to the clipboard (with the old way for a browser that does not let the page write it), and the words
// that hand an item to a coding agent.

import type { Item } from '../../model/types'

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const t = document.createElement('textarea')
    t.value = text
    document.body.append(t)
    t.select()
    document.execCommand('copy')
    t.remove()
  }
}

/** A task to carry out, or an item to work on, for a coding agent: with where to read it. */
export const forAgent = (it: Item, code: string, base: string) =>
  it.type === 'task'
    ? `${it.title}\n\n${it.body}\n\nCarry this out in the current project. Write the result and how you checked it back to Taska item ${code} (usage: curl -s ${base}/agent).`
    : `Work on Taska item ${code}: ${it.title}\nDetails: curl -s ${base}/${code}\nUsage: curl -s ${base}/agent`
