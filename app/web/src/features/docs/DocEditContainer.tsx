// The editor with the page's data: the text being edited (the document's own until you change it), and what its
// buttons do.

import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useProjectModel } from '../../app/hooks'
import { noteText } from '../../model/docs'
import { DocEdit } from './DocEdit'

export function DocEditContainer({ slug }: { slug: string }) {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const m = useProjectModel(slug)
  const v = useStoreValue(app.stores.docView, (s) => s)
  const d = v.newFor == null && v.d != null ? m?.docs.find((x) => x.d === v.d) : undefined
  const text = v.text ?? (d ? noteText(d) : '')
  return (
    <DocEdit
      isNew={!d}
      text={text}
      hint={desk ? 'First line is the title. Esc keeps it as a draft.' : 'The first line is the title.'}
      mic={{ on: false, text: 'Speak' }}
      on={{
        change: (t) => app.stores.docView.getState().setText(t),
        discard: () => app.docs.discard(),
        save: () => void app.docs.save(),
        mic: () => {},
      }}
    />
  )
}
