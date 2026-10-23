// T518 (#6195): a component story shows the desktop and the phone at once, nothing to pick; a part the page has on
// one of them only shows there only. Each is the same story in a frame of that size (?single=1 draws it as it is),
// so the page's own "is this the desktop?" answers as on a real screen. The words above each frame name it; they
// are not part of the page; the grey around the frames is Storybook's, not the page's.
import { useEffect, useRef, useState } from 'react'

export type Platform = 'both' | 'desktop' | 'phone'
const SIZE = { desktop: [1440, 900], phone: [393, 852] } as const

function Frame({ id, scheme, on, width }: { id: string; scheme: string; on: 'desktop' | 'phone'; width: number }) {
  const [w, h] = SIZE[on]
  const scale = Math.min(1, width / w)
  const ref = useRef<HTMLIFrameElement>(null)
  const [tall, setTall] = useState<number>(h)
  useEffect(() => {
    // as tall as what the story draws: a part that fills the screen keeps the screen's height, a short one (a row, a
    // card) gets a short frame. The story's page is always a whole screen, so it lays out as on a real one; the frame
    // only shows its top, as far down as the story draws: its content, and what floats over the page (a picture
    // viewer, a tip: not in the flow, so measured on its own). Measured again whenever any of it changes (T529: once
    // or twice after a wait was too early on a busy computer, and a short story stayed a whole screen high).
    const f = ref.current
    if (!f) return
    let stop = () => {}
    const watch = () => {
      stop()
      const doc = f.contentDocument,
        win = doc?.defaultView,
        root = doc?.getElementById('storybook-root')
      if (!doc || !win || !root) return
      let job = 0
      const measure = () => {
        job = 0
        const inner = root.firstElementChild
        if (f.contentDocument !== doc || !inner) return // gone, or nothing drawn yet
        let used = inner.getBoundingClientRect().bottom
        // what floats (position: fixed) has no offset parent; one hidden or inside a hidden part has no box
        for (const el of doc.body.querySelectorAll<HTMLElement>('*'))
          if (el.offsetParent === null && el.getClientRects().length && win.getComputedStyle(el).position === 'fixed')
            used = Math.max(used, el.getBoundingClientRect().bottom)
        used = Math.ceil(used)
        setTall(used >= h - 60 ? h : Math.max(120, used))
      }
      const soon = () => {
        if (!job) job = window.setTimeout(measure, 100)
      }
      const ro = new win.ResizeObserver(soon),
        mo = new win.MutationObserver(soon)
      ro.observe(root)
      mo.observe(doc.body, { subtree: true, childList: true, attributes: true })
      soon()
      stop = () => {
        ro.disconnect()
        mo.disconnect()
        clearTimeout(job)
      }
    }
    f.addEventListener('load', watch) // and each time it loads a story again (another scheme)
    watch()
    return () => {
      f.removeEventListener('load', watch)
      stop()
    }
  }, [h])
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">
        {on === 'desktop' ? 'Desktop 1440' : 'Phone 393'}
      </h3>
      <div style={{ width: w * scale, height: tall * scale }} className="relative overflow-hidden">
        <iframe
          ref={ref}
          title={on}
          src={`${location.pathname}?id=${id}&viewMode=story&single=1&globals=scheme:${scheme}`}
          style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0' }}
          className="absolute top-0 left-0 border-0"
        />
      </div>
    </section>
  )
}

export function Both({ id, scheme, platform = 'both' }: { id: string; scheme: string; platform?: Platform }) {
  const [width, setWidth] = useState(() => innerWidth - 32)
  useEffect(() => {
    const on = () => setWidth(innerWidth - 32)
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return (
    <div className="min-h-screen bg-zinc-100 p-4 dark:bg-zinc-900">
      {platform !== 'phone' ? <Frame id={id} scheme={scheme} on="desktop" width={width} /> : null}
      {platform !== 'desktop' ? <Frame id={id} scheme={scheme} on="phone" width={width} /> : null}
    </div>
  )
}
export const single = () => new URLSearchParams(location.search).has('single')
