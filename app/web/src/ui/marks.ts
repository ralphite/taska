// The searched words marked inside drawn text (Markdown drawn as HTML), in the elements marked data-hit-html under
// `ref`: each found word wrapped in a yellow mark; the marks of an earlier search go first.

import { useLayoutEffect, type RefObject } from 'react'

export function useMarks(ref: RefObject<HTMLElement | null>, words: readonly string[]): void {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    for (const m of root.querySelectorAll('mark[data-mark]')) m.replaceWith(document.createTextNode(m.textContent || ''))
    root.normalize()
    if (!words.length) return
    const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i')
    for (const el of root.querySelectorAll('[data-hit-html]')) {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      while (walk.nextNode()) {
        const t = walk.currentNode as Text
        if (!t.parentElement?.closest('mark') && re.test(t.data)) nodes.push(t)
      }
      for (const t of nodes)
        t.replaceWith(
          ...t.data.split(re).map((s, i) => {
            if (!(i % 2)) return document.createTextNode(s)
            const m = document.createElement('mark')
            m.className = 'rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-400/30'
            m.dataset.mark = ''
            m.textContent = s
            return m
          }),
        )
    }
  })
}
