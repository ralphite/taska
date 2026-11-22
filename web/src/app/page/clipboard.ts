// Copying to the clipboard (with the old way for a browser that does not let the page write it), and the words
// that hand a task to a coding agent.

import type { Task } from '../../model/types'

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

/** A task to work on, for a coding agent: with where to read it (its card has everything it is part of, T853). */
export const forAgent = (it: Task, code: string, base: string) =>
  `Work on Taska task ${code}: ${it.title}\nDetails: curl -s ${base}/${code}\nUsage: curl -s ${base}/agent`
