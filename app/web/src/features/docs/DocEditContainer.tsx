// The editor with the page's data: the text being edited (the document's own until you change it), and what its
// buttons do.

import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel } from '../../app/hooks'
import { noteText } from '../../model/docs'
import { DocEdit } from './DocEdit'
import { editFacts } from './docFacts'

export function DocEditContainer({ slug }: { slug: string }) {
  const app = useServices('dictation', 'docEditor', 'fields')
  const stores = useStores('dictation', 'docView')
  const desk = useLayout() === 'desk'
  const m = useProjectModel(slug)
  const v = useStoreValue(stores.docView, (s) => s)
  const d = v.newFor == null && v.d != null ? m?.docs.find((x) => x.d === v.d) : undefined
  const text = v.text ?? (d ? noteText(d) : '')
  const rec = useStoreValue(stores.dictation, (s) => s.rec)
  const key = d ? `D${d.d}` : `new ${v.newFor}`
  const waiting = useStoreValue(stores.dictation, (s) => s.waiting.filter((w) => w.key === key).length)
  return (
    <DocEdit
      isNew={!d}
      text={text}
      {...editFacts(rec, waiting, desk)}
      fieldRef={app.fields.ref('doc')}
      on={{
        change: (t) => stores.docView.getState().setText(t),
        discard: () => app.docEditor.discard(),
        save: () => void app.docEditor.save(),
        mic: () => app.dictation.toggle(),
      }}
    />
  )
}
