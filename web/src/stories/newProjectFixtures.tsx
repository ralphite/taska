// New project as the page opens it (D115 #7): a small popover at its button on the desktop, a sheet on the phone,
// titled New project, holding the page's NewProjectForm (its tile as it will be among these projects). Used by the
// stories of the sidebar, the home page and Settings.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { popAt } from '../app/page/sheets'
import { NewProjectForm } from '../ui/NewProjectForm'
import { Sheet, SheetLayout } from '../ui/Sheet'
import { newProjectTone } from '../ui/tones'
import { acts } from './acts'

const npActs = acts('New project', ['create', 'cancel'] as const)
/** the projects there are (their addresses), for the tile's colour */
const NAMES = ['home', 'shop', 'notes', 'long', 'taska']

/** `under` with New project open over it; on the desktop at its New project button, as the page opens it (`beside`:
 * right of it, from the rail); `error`: why it was not made; `value`: the name typed. Create and Esc are the story's
 * own (`onDone`). */
export function withNewProject(under: ReactNode, desk: boolean, o: { beside?: boolean; /** no button under it: here */ at?: { x: number; y: number }; value?: string; error?: string; onDone?(): void } = {}) {
  return <Over under={under} desk={desk} o={o} />
}

function Over({ under, desk, o }: { under: ReactNode; desk: boolean; o: Parameters<typeof withNewProject>[2] & object }) {
  const box = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<ReturnType<typeof popAt> | { x: number; y: number } | null>(o.at ?? null)
  useLayoutEffect(() => {
    // the button, in the frame (the popover is placed in it as in a window)
    const el = box.current
    const btn = [...(el?.querySelectorAll('button') ?? [])].find((b) => (b.getAttribute('aria-label') || b.textContent || '').trim() === 'New project')
    const frame = el?.closest('[class*="@container/frame"]')?.getBoundingClientRect()
    if (!btn || !frame) return setAt(o.at ?? { x: 16, y: 120 })
    const r = btn.getBoundingClientRect()
    setAt(popAt({ left: r.left - frame.left, right: r.right - frame.left, top: r.top - frame.top, bottom: r.bottom - frame.top }, o.beside))
  }, [o.beside, o.at])
  return (
    <div ref={box} className="relative h-full">
      {under}
      <Sheet open={!desk || !!at} look={desk ? { pop: true, at } : {}} desk={desk} onClose={() => (npActs.cancel(), o.onDone?.())}>
        <SheetLayout
          title="New project"
          body={
            <div className="pb-1">
              {/* words already typed in its field */}
              <NewProjectForm
                error={o.error ?? ''}
                tone={(n) => newProjectTone(NAMES, n)}
                typed={o.value ?? ''}
                onCreate={(t) => (npActs.create(t), o.onDone?.())}
                onCancel={() => (npActs.cancel(), o.onDone?.())}
              />
            </div>
          }
        />
      </Sheet>
    </div>
  )
}
