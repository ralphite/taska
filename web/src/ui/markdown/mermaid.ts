// Mermaid drawings as the page shows them (the drawing itself is app/page/diagrams.ts): Mermaid's message, and an
// SVG given ids of its own, so two copies of a diagram never share markers or styles.

/** Mermaid's message, its first lines. */
export const mermaidError = (e: unknown) => (e instanceof Error ? e.message : String(e)).split('\n').slice(0, 4).join('\n')

/** The SVG with its ids (and every reference to them) made unique to `prefix`. */
export function isolateSvg(source: string, prefix: string): string {
  const template = document.createElement('template')
  template.innerHTML = source
  const svg = template.content.querySelector('svg')
  if (!svg) return source
  const ids = new Map<string, string>()
  for (const el of [svg, ...svg.querySelectorAll('[id]')]) {
    const id = el.getAttribute('id')
    if (id) ids.set(id, el === svg ? prefix : `${prefix}-${ids.size}`)
  }
  const urls = (v: string) => v.replace(/url\(\s*(['"]?)#([^\s)'"]+)\1\s*\)/g, (m, q: string, id: string) => (ids.has(id) ? `url(${q}#${ids.get(id)}${q})` : m))
  const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const selectors = ids.size ? new RegExp(`#(${[...ids.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\w-])`, 'g') : null
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      let v = attr.value
      if (attr.name === 'id') v = ids.get(v) || v
      else if (attr.name === 'href' || attr.name === 'xlink:href') v = v.startsWith('#') && ids.has(v.slice(1)) ? `#${ids.get(v.slice(1))}` : v
      else if (attr.name === 'aria-labelledby' || attr.name === 'aria-describedby') v = v.split(/\s+/).map((x) => ids.get(x) || x).join(' ')
      else v = urls(v)
      if (v !== attr.value) el.setAttribute(attr.name, v)
    }
    // selectors' ids apart from declarations, so a colour like #fff stays a colour
    if (el.tagName.toLowerCase() === 'style')
      el.textContent = urls(el.textContent || '').replace(/(^|[{}])([^{}]*)(?=\{)/g, (_, b: string, sel: string) => b + (selectors ? sel.replace(selectors, (_m: string, id: string) => `#${ids.get(id)}`) : sel))
  }
  return template.innerHTML
}
