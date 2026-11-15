// New shared rules with the page's data (I779): named as a new project is (a popover on the desktop, a sheet on the
// phone); made, it opens to be written.

import { useState } from 'react'
import { useServices } from '../../app/context'
import { NewProjectForm } from '../../ui/NewProjectForm'
import { SheetLayout } from '../../ui/Sheet'

export function NewSharedSheet() {
  const app = useServices('sharedRules', 'sheets')
  const [error, setError] = useState('')
  return (
    <SheetLayout
      title="New shared rules"
      body={
        <div className="pb-1">
          <NewProjectForm
            what="Shared rules"
            error={error}
            tone={() => ''}
            onCreate={(name) => void app.sharedRules.create(name).then((why) => why && setError(why))}
            onCancel={() => app.sheets.close()}
          />
        </div>
      }
    />
  )
}
