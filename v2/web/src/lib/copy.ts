// Copy to the clipboard, and the text that hands an item to a coding agent.
import { byN, code, ctx } from './state'
import { toast } from './toast'

export async function copy(text: string, done = 'Copied') {
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
  toast(done)
}
export function copyItem(n: number) {
  const it = byN.get(n)
  if (!it) return
  const c = code(n),
    base = ctx.BASE
  const text =
    it.type === 'task'
      ? `${it.title}\n\n${it.body}\n\nCarry this out in the current project. Write the result and how you checked it back to Taska item ${c} (usage: curl -s ${base}/agent).`
      : `Work on Taska item ${c}: ${it.title}\nDetails: curl -s ${base}/${c}\nUsage: curl -s ${base}/agent`
  return copy(text, 'Copied. Paste it to your agent.')
}
