// The box with the page's data: what it writes to (its line, placeholder and Send), the draft's words and files, a
// voice note recording into it, the words that may be misheard (under the box; on the phone in the box, to pick
// from), and where Send sends it.

import { useLayoutEffect, type RefObject } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import type { ProjectRoute } from '../../app/hooks'
import { shownBox } from '../../model/boxFoot'
import { clock } from '../../model/time'
import { Composer } from './Composer'
import { Doubts, DraftWords, type DoubtsView } from './Doubts'
import { DraftFiles } from './DraftFiles'
import { useBoxHere } from './boxHere'
import { useHeard } from './heard'

const EMPTY: Record<string, string> = {}

/** `bare`: just the box (Settings' transcription preferences), which writes what the box shown writes */
export function BoxContainer({ route, composePage, boxRef, bare = false }: { route: ProjectRoute; composePage: boolean; boxRef?: RefObject<HTMLDivElement | null>; bare?: boolean }) {
  const app = useServices('box', 'docChoices', 'docComments', 'docVoice', 'docs', 'fields', 'media', 'settings', 'voice', 'voiceWords')
  const stores = useStores('box', 'drafts', 'recording')
  const { m, desk, mode, pick, role, key } = useBoxHere(route)
  useLayoutEffect(() => {
    if (!bare) stores.box.getState().setShown(key, role.scope)
  }, [app, stores, key, role.scope, bare])
  const recording = useStoreValue(stores.recording, (s) => s.rec)
  // the recording shows in the box wherever you are; it goes to the draft it was started in
  const rec = recording && recording.slug === route.slug ? { time: clock(recording.ms), levels: recording.levels, from: recording.from } : null
  const drafts = useStoreValue(stores.drafts, (s) => s.bySlug[route.slug]) || EMPTY
  const text = drafts[key] ?? ''
  const shown = shownBox(role, { mode, text, key, recordingFor: recording && rec ? recording.key : null })
  const draftFiles = useStoreValue(stores.box, (s) => s.files[key])
  const showWords = useStoreValue(stores.box, (s) => s.showWords)
  const heard = useHeard(text, draftFiles)

  const send = () => {
    if (mode?.kind === 'prefs') return void app.settings.savePrefs(route.slug)
    if (mode?.kind === 'comment') return void app.docComments.saveComment(route.slug, mode.d, mode.id, key)
    if (shown.voiceComments && role.doc != null) return void app.docVoice.post(route.slug, role.doc, key) // each quote's words, a comment on its passage
    if (role.aim) return void app.docComments.comment(route.slug, role.aim.d, role.aim.target, key)
    void app.box.send(route.slug, m, role.scope, key)
  }
  const url = (f: string) => `/p/${encodeURIComponent(route.slug)}/f/${encodeURIComponent(f)}`
  // words of a voice note that may be misheard: under the box; on the phone in the box itself, to pick from
  const pickWord = (fk: string, k: number, side: 'was' | 'alt') => void app.voiceWords.pick(route.slug, key, fk, k, side)
  const viewWords = !desk && heard.pickable && showWords && !rec
  const doubtsView: DoubtsView | null =
    desk && composePage ? (heard.altOpen ? { kind: 'card', toCheck: heard.altOpen } : null) : !desk ? (heard.pickable ? { kind: 'phone', toCheck: heard.altOpen, showing: viewWords } : null) : heard.open.length ? { kind: 'list', lines: heard.open } : null
  const doubts = doubtsView ? <Doubts view={doubtsView} on={{ use: (fk, k) => app.voiceWords.use(route.slug, key, fk, k), show: () => app.voiceWords.show(true) }} /> : null
  const phoneWords = viewWords ? (
    <DraftWords
      text={text}
      spots={heard.spots}
      className="col-start-1 row-start-1 max-h-48 min-h-11 overflow-y-auto px-1 py-1.5 text-[17px] leading-8 break-words whitespace-pre-wrap text-zinc-900 roomy:text-[15px] dark:text-zinc-100"
      on={{ pick: pickWord, escape: () => app.fields.focus('box'), plain: () => app.voiceWords.show(false) }}
    />
  ) : null
  return (
    <Composer
      line={shown.line}
      waiting={shown.waiting}
      lineOn={{
        stop: () => app.box.stop(),
        unpick: () => app.docs.unpick(),
        toItem: () => app.docs.toItem(),
        sendTicks: () => pick.d != null && void app.docChoices.sendTicks(route.slug, pick.d),
        clearTicks: () => pick.d != null && app.docChoices.clearTicks(pick.d),
      }}
      placeholder={shown.placeholder}
      sendWord={shown.send}
      text={text}
      desk={desk}
      composePage={desk && composePage}
      micTip={composePage ? 'Voice note · ⌥V' : 'Voice note · V'}
      boxRef={boxRef}
      fieldRef={app.fields.ref('box')}
      lineOnComposePage={!!mode}
      hasFiles={!!draftFiles?.length}
      files={
        <DraftFiles
          files={draftFiles || []}
          url={url}
          onRemove={(fk) => app.box.removeFile(route.slug, key, fk)}
          onView={(fk) => {
            // a picture of the draft, with its others that are up
            const pics = (draftFiles || []).filter((x) => x.f && (x.mime || '').startsWith('image/')).map((x) => x.f)
            const f = draftFiles?.find((x) => x.key === fk)?.f
            if (f) app.media.view(route.slug, pics, f)
          }}
        />
      }
      doubts={doubts}
      words={phoneWords}
      rec={rec}
      on={{
        text: (v) => app.box.write(route.slug, key, v),
        send,
        attach: (list) => app.box.attach(route.slug, key, list),
        mic: (aux) => void app.voice.start(route.slug, key, role.scope, aux ? 'aux' : 'main'),
        recCancel: () => void app.voice.cancel(),
        recStop: () => void app.voice.finish(false),
        recSend: () => void app.voice.finish(true),
      }}
    />
  )
}
