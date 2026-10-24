// The editor with the page's data: the text being edited (the document's own until you change it), and what its
// buttons do.

import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useProjectModel } from '../../app/hooks'
import { noteText } from '../../model/docs'
import { DocEdit } from './DocEdit'
import { clock } from '../../model/time'

export function DocEditContainer({ slug }: { slug: string }) {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const m = useProjectModel(slug)
  const v = useStoreValue(app.stores.docView, (s) => s)
  const d = v.newFor == null && v.d != null ? m?.docs.find((x) => x.d === v.d) : undefined
  const text = v.text ?? (d ? noteText(d) : '')
  const rec = useStoreValue(app.stores.dictation, (s) => s.rec)
  const key = d ? `D${d.d}` : `new ${v.newFor}`
  const waiting = useStoreValue(app.stores.dictation, (s) => s.waiting.filter((w) => w.key === key).length)
  return (
    <DocEdit
      isNew={!d}
      text={text}
      hint={
        rec
          ? 'Listening. Words go at the mark; you can keep typing.'
          : waiting
            ? `Working out the words of ${waiting > 1 ? waiting + ' voice notes' : 'the voice note'}\u2026`
            : desk
              ? 'First line is the title. Esc keeps it as a draft.'
              : 'The first line is the title.'
      }
      mic={{ on: !!rec, text: rec ? `Stop ${clock(rec.ms)}` : 'Speak' }}
      fieldRef={app.fields.ref('doc')}
      on={{
        change: (t) => app.stores.docView.getState().setText(t),
        discard: () => app.docs.discard(),
        save: () => void app.docs.save(),
        mic: () => app.dictation.toggle(),
      }}
    />
  )
}
