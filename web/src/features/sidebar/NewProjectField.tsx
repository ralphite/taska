// The sidebar's New project: the page's one form for naming a new project, where the projects are. Props only.

import { NewProjectForm } from '../../ui/NewProjectForm'

export function NewProjectField({ error, on }: { error: string; on: { create(title: string): void; cancel(): void } }) {
  return (
    <div className="mt-1 px-1">
      <NewProjectForm error={error} onCreate={on.create} onCancel={on.cancel} />
    </div>
  )
}
