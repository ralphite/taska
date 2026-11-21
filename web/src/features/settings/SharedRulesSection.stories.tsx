// T779 (D134): Settings › Shared rules, after Organizer: New shared rules first, then each shared rule's name, how many
// projects put it in and when it last changed; a row opens its page (Pages › A shared rule's page). No switches: a
// project puts one in by a line of its rules. Drawn by the page's Settings with the stories' shared rules.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NewProjectForm } from '../../ui/NewProjectForm'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { acts } from '../../stories/acts'
import { Frames } from '../../stories/Frames'
import { one } from '../../stories/sectionsFixtures'
import { settingsAt } from '../../stories/settingsFixtures'

export default { title: 'UI/Settings and help/Settings/Shared rules', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const on = acts('New shared rules', ['create', 'cancel'] as const)

/** The list: each shared rule, how many projects put it in, when it last changed. */
export const List: Story = { ...one('shared'), name: 'The list' }

/** Still to load. */
export const Loading: Story = { ...one('shared', { shared: 'loading' }), name: 'Loading' }

/** None yet: New shared rules. */
export const None: Story = { ...one('shared', { shared: 'none' }), name: 'None yet' }

/** The phone's sections, Shared rules last, with how many there are. */
export const PhoneIndex: Story = { name: 'The phone’s sections', render: () => <Frames desk={false}>{() => settingsAt(null, false)}</Frames> }

/** New shared rules: named as a new project is (a popover at its button on the desktop, a sheet on the phone); made,
 * it opens to be written. A name another has is refused, said under it. */
export const Naming: Story = {
  name: 'New shared rules: naming',
  render: () => (
    <Frames deskWidth={1100} height={760}>
      {(layout) => (
        <div className="relative h-full">
          {settingsAt('shared', layout === 'desk')}
          <Sheet open look={layout === 'desk' ? { pop: true, at: { x: 334, y: 236 } } : {}} desk={layout === 'desk'} onClose={on.cancel}>
            <SheetLayout title="New shared rules" body={<div className="pb-1"><NewProjectForm what="Shared rules" error="shared rules called 编程 exist already" typed="编程" tone={() => ''} onCreate={on.create} onCancel={on.cancel} /></div>} />
          </Sheet>
        </div>
      )}
    </Frames>
  ),
}
