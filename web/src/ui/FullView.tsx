// A document's diagram or table seen on the whole window (T839, Yadong r1441 r1443): its button at the top right
// (on the desktop when it is pointed at, on the phone always, as nothing hovers there) opens it over everything, the
// width of the window, scrolling either way; × or Esc closes it. Pictures have the viewer and videos their own
// full screen. Props only.

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export function FullView({ label, children, full, open: start = false }: { label: string; children: ReactNode; full?: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(start)
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation() // it closes this, not the document under it
      setOpen(false)
    }
    addEventListener('keydown', esc, true)
    return () => removeEventListener('keydown', esc, true)
  }, [open])
  return (
    <div className="group/full relative">
      {children}
      <button
        onClick={() => setOpen(true)}
        aria-label={`Full screen: ${label}`}
        title="Full screen"
        className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-lg bg-white/90 text-zinc-600 shadow-sm ring-1 ring-zinc-200 hover:text-zinc-900 focus-visible:opacity-100 lg:opacity-0 lg:group-hover/full:opacity-100 dark:bg-zinc-800/90 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:text-zinc-100"
      >
        <Icon n="open" c="size-4" />
      </button>
      {open
        ? createPortal(
            <div role="dialog" aria-label={label} className="fixed inset-0 z-50 flex flex-col bg-white pt-[env(safe-area-inset-top)] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
              <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 py-1 pr-1 pl-4 dark:border-zinc-800">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                <button autoFocus onClick={() => setOpen(false)} aria-label="Close" className="grid size-11 place-items-center rounded-full outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800">
                  <Icon n="x" />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-8 lg:scrollbar-thin">{full ?? children}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
