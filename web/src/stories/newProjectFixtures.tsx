// New project as the page opens it (D115 #7): a small popover at its button on the desktop, a sheet on the phone,
// titled New project, holding the page's NewProjectForm (its tile as it will be among these projects). Used by the
// stories of the sidebar, the home page and Settings.
import type { ReactNode } from 'react'
import { NewProjectForm } from '../ui/NewProjectForm'
import { Sheet, SheetLayout } from '../ui/Sheet'
import { newProjectTone } from '../ui/tones'
import { acts } from './acts'

const npActs = acts('New project', ['create', 'cancel'] as const)
/** the projects there are (their addresses), for the tile's colour */
const NAMES = ['home', 'shop', 'notes', 'long', 'taska']

/** `under` with New project open over it; `at`: where its button is on the desktop (the popover's corner); `error`:
 * why it was not made; `value`: the name typed. Create and Esc are the story's own (`onDone`). */
export function withNewProject(under: ReactNode, desk: boolean, o: { at?: { x: number; y: number }; value?: string; error?: string; onDone?(): void } = {}) {
  return (
    <div className="relative h-full">
      {under}
      <Sheet open look={desk ? { pop: true, at: o.at ?? { x: 16, y: 120 } } : {}} desk={desk} onClose={() => (npActs.cancel(), o.onDone?.())}>
        <SheetLayout
          title="New project"
          body={
            <div className="pb-1">
              <NewProjectForm
                value={o.value}
                error={o.error ?? ''}
                tone={(n) => newProjectTone(NAMES, n)}
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
