// B498 (r815, #7079): for Review, not built yet. One control for every place picked in a page to comment on (a
// Markdown paragraph, a part of a web page): two buttons beside it, voice and comment. Voice turns them, where they
// are, into a small recording strip like the input box's, with no text field: the voice button becomes ✓ (stop: the
// words go into the real input box below, at this place), the comment button becomes ↑ (send at once), and ✕ at the
// far left cancels. Comment (words) writes in the real input box below, at this place.
// Only the control and the place it is on are drawn here (the new design); the rest is the page's own: the input box
// (Composer, its line from the page's boxRole), the recording strip's dot, time and level (Composer's RecBar), the
// comment opened on its place (Thread) and the toast (Toast). The recorder is not real: its time runs and its level
// moves by itself.
import { useEffect, useState } from 'react'
import { RecBar } from '../../features/composer/Composer'
import { Thread } from '../../features/docs/Thread'
import { Toast } from '../../features/feedback/Toast'
import { clock } from '../../model/time'
import type { Comment } from '../../model/types'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'
import { VOICE, boxAt, boxProject } from '../boxFixtures'
import { docOn, envOf } from '../docPage'
import { T } from '../fixtures'

export type Step = 'picked' | 'typing' | 'recording' | 'checked' | 'sent' | 'cancelled'
export type Kind = 'md' | 'web'

// what is said about each place (the comment's words), and the place's words; the documents are the box's D1 (Markdown)
// and D2 (a web page)
const SAID: Record<Kind, string> = { md: 'How long does this step take?', web: 'Can 410 ms be any faster?' }
const QUOTE: Record<Kind, string> = { md: 'Apply the current filter when writing the file.', web: 'Write CSV 410 ms' }
const AT: Record<Kind, { at: string; key: string }> = { md: { at: 'D1', key: 'k1' }, web: { at: 'D2', key: 'p1' } }

// ---------------------------------------------------------------- the recorder (not real): its time and its level

/** While it is drawn: the time since it began, and a voice's level (a few syllables a second, quieter between) */
function useRecorder(n: number) {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const tick = window.setInterval(() => setMs(Date.now() - t0), 110)
    return () => clearInterval(tick)
  }, [])
  const levels = Array.from({ length: n }, (_, i) => {
    const x = (ms / 1000) * 5 - i * 0.55
    return Math.max(0.08, Math.abs(Math.sin(x)) * (0.45 + 0.55 * Math.abs(Math.sin(x * 0.37 + i))))
  })
  return { time: clock(ms), levels }
}

// ---------------------------------------------------------------- the control

// the page's own small buttons beside a part (WebPage, BlockActs)
const SMALL = 'grid size-7 shrink-0 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white'
// the input box's buttons: plain, and the round dark one
const PLAIN = (phone: boolean) => `grid shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${phone ? 'size-11' : 'size-8'}`
const MAIN = (phone: boolean) => `grid shrink-0 place-items-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${phone ? 'size-11' : 'size-8'}`

function B({ icon, label, cls, on, big, sw }: { icon: IconName; label: string; cls: string; on(): void; big?: boolean; sw?: string }) {
  return (
    <button data-proto={icon} aria-label={label} title={label} onClick={on} className={cls}>
      <Icon n={icon} c={big ? 'size-5' : 'size-4'} sw={sw} />
    </button>
  )
}

interface Go {
  speak(): void
  write(): void
  cancel(): void
  check(): void
  send(): void
}

/** Speaking: ✕ · the box's recording strip · ✓ · ↑, where the two buttons were (the pointer stays put) */
function Strip({ go, phone }: { go: Go; phone: boolean }) {
  const rec = useRecorder(phone ? 12 : 6)
  return (
    <>
      <B icon="x" label={phone ? 'Cancel' : 'Cancel · Esc'} cls={PLAIN(phone)} on={go.cancel} big={phone} />
      <span className={`flex items-center gap-1.5 ${phone ? 'min-w-0 flex-1' : 'w-28'}`}>
        <RecBar time={rec.time} levels={rec.levels} />
      </span>
      <B icon="check" label="Stop: the words go into the box below" cls={PLAIN(phone)} on={go.check} big={phone} sw="2.5" />
      <B icon="up" label="Stop and send" cls={MAIN(phone)} on={go.send} big={phone} sw="2.25" />
    </>
  )
}
/** Desktop: the two buttons beside the place; speaking, the strip */
function DeskControl({ step, go }: { step: Step; go: Go }) {
  if (step === 'recording')
    return (
      <div data-proto="strip" role="status" aria-label="Recording" className="flex h-9 items-center gap-1 rounded-full bg-white p-0.5 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
        <Strip go={go} phone={false} />
      </div>
    )
  return (
    <div className="flex gap-1">
      <B icon="mic" label="Speak a comment" cls={SMALL} on={go.speak} />
      <B icon="comment" label="Comment" cls={SMALL} on={go.write} />
    </div>
  )
}
/** Phone: under the place, as the row under a tapped paragraph is now; the same rules, made for a thumb */
function PhoneControl({ step, go }: { step: Step; go: Go }) {
  return (
    <div className="flex h-12 items-center gap-2">
      {step === 'recording' ? (
        <Strip go={go} phone />
      ) : (
        <>
          <span className="min-w-0 flex-1 pl-2 text-[13px] text-zinc-500 dark:text-zinc-400">Speak or write about it</span>
          <B icon="mic" label="Speak a comment" cls={`${MAIN(true)} shadow-lg`} on={go.speak} big />
          <B icon="comment" label="Comment" cls="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-600 dark:hover:bg-zinc-800" on={go.write} big />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- the place, and what is on it

/** The comment posted, opened on its place (the page's Thread): right away, its words still coming (…, Sending…); a
 * moment later, its words */
function Posted({ kind, rail, desk }: { kind: Kind; rail: boolean; desk: boolean }) {
  const [words, setWords] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setWords(true), 1600)
    return () => clearTimeout(t)
  }, [])
  // a comment being saved has no id yet (and no Edit, Move or Delete)
  const c: Comment = { id: words ? 9101 : -1, key: AT[kind].key, th: 9101, quote: QUOTE[kind], text: words ? SAID[kind] : '…', by: 'you', t: T, files: [] }
  return <Thread t={{ tk: `${AT[kind].key}#9101`, comments: [c], quote: QUOTE[kind] }} blockText={QUOTE[kind]} rail={rail} isNew={false} done={false} replying={false} asking={null} env={envOf(boxProject(), desk)} on={docOn} />
}
/** a thread's count, in its place's top right corner (WebPage) or beside the paragraph (BlockActs) */
const Count = ({ cls }: { cls: string }) => (
  <span className={`flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 shadow-sm dark:bg-amber-900/80 dark:text-amber-100 ${cls}`}>
    <Icon n="comment" c="size-3.5" />1
  </span>
)
const RING = 'ring-2 ring-amber-300 dark:ring-amber-600'

function MdPlace({ phone, step, go }: { phone: boolean; step: Step; go: Go }) {
  const sent = step === 'sent'
  return (
    <div className={`text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 ${phone ? 'px-4 pt-4' : 'pt-5 pr-24 pl-8'}`}>
      <div className="text-xl font-bold tracking-tight">Export plan</div>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">Two ways to ship filtered export, and what each costs.</p>
      {/* the paragraph picked */}
      <section className={`relative -mx-2 mt-3 rounded-lg px-2 py-1 ${sent ? '' : `bg-amber-50 dark:bg-amber-950/40 ${RING}`}`}>
        <div className={phone && sent ? 'pr-12' : ''}>{QUOTE.md} The file then holds what you see in the list, and the server need not change.</div>
        {phone ? (
          <>
            {sent ? <Count cls="absolute top-1 right-1" /> : null}
            {sent ? (
              <Posted kind="md" rail={false} desk={false} />
            ) : (
              <div className="mt-2">
                <PhoneControl step={step} go={go} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* beside it, as the paragraph's buttons are now; speaking, the strip ends where they end and grows to the
                left, over the paragraph's first line */}
            {sent ? (
              <Count cls="absolute top-0 left-full ml-1" />
            ) : (
              <div className="absolute top-0 -right-17 z-10 flex justify-end">
                <DeskControl step={step} go={go} />
              </div>
            )}
            {sent ? (
              <div className="absolute top-full -right-16 z-20 mt-2 w-80 text-sm shadow-xl">
                <Posted kind="md" rail desk />
              </div>
            ) : null}
          </>
        )}
      </section>
      <p className="mt-3 text-zinc-700 dark:text-zinc-300">Option B saves filters on the server and ships next week.</p>
    </div>
  )
}

/** a row of the page's bars (label, bar, time) */
const Bar = ({ label, w, ms }: { label: string; w: string; ms: string }) => (
  <div className="grid grid-cols-[84px_1fr_52px] items-center gap-2.5 text-[13px]">
    {label}
    <div className="h-3 overflow-hidden rounded-md bg-zinc-100">
      <div className={`h-full rounded-md bg-blue-500 ${w}`} />
    </div>
    {ms}
  </div>
)

function WebPlace({ phone, step, go }: { phone: boolean; step: Step; go: Go }) {
  const sent = step === 'sent'
  return (
    // the page as it is: its own colors (white), whatever Taska's are
    <div className={`bg-white text-zinc-900 ${phone ? 'px-4 pt-4 pb-2' : 'px-8 pt-5 pb-3'}`}>
      <div className="mb-3 text-[17px] font-semibold">Where the time goes</div>
      <div className="flex flex-col gap-2">
        <Bar label="Read list" w="w-[72%]" ms="720 ms" />
        <Bar label="Apply filter" w="w-[18%]" ms="180 ms" />
        {/* the part picked: the amber ring around it; on the desktop its buttons just above its right end */}
        <div className="relative">
          <Bar label="Write CSV" w="w-[41%]" ms="410 ms" />
          <div className={`pointer-events-none absolute -inset-1 rounded-lg ${sent ? 'ring-2 ring-amber-400' : RING}`} />
          {sent ? <Count cls="absolute -top-4 -right-3" /> : null}
          {!phone && !sent ? (
            <div className="absolute -top-11 right-0 z-10">
              <DeskControl step={step} go={go} />
            </div>
          ) : null}
          {sent ? (
            <div className={`absolute top-full z-20 mt-3 text-sm text-zinc-900 shadow-xl dark:text-zinc-100 ${phone ? 'inset-x-0' : 'right-0 w-80'}`}>
              <Posted kind="web" rail desk={!phone} />
            </div>
          ) : null}
          {phone && !sent ? (
            // on the phone, under the part, over the page (as the row under a tapped part is now)
            <div className="absolute inset-x-0 top-full z-10 mt-3 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10">
              <PhoneControl step={step} go={go} />
            </div>
          ) : null}
        </div>
      </div>
      <div className={`text-[17px] font-semibold ${phone ? 'mt-24' : 'mt-8'}`}>Options</div>
      <div className="mt-2 rounded-xl border border-zinc-200 p-3 text-[13px] text-zinc-600">A · Filter on export: apply the current filter when writing the file.</div>
    </div>
  )
}

/** The page's input box below, as it is at each step: at this place (its line says what it comments on) while you
 * write, and with the voice note and its words after ✓; as it was while you speak. */
function Box({ kind, step, phone }: { kind: Kind; step: Step; phone: boolean }) {
  const here = AT[kind]
  const at = step === 'typing' || step === 'checked'
  return boxAt(
    at
      ? { at: here.at, quote: { key: here.key, text: QUOTE[kind] }, ...(step === 'checked' ? { text: SAID[kind], files: [{ ...VOICE, ms: 3000, tr: SAID[kind] }] } : {}) }
      : { at: here.at },
    !phone,
  )
}

/** One place picked, its control, and the input box below where it matters; it plays from `start` as you tap */
export function Scene({ kind, phone, start }: { kind: Kind; phone: boolean; start: Step }) {
  const [step, setStep] = useState<Step>(start)
  const go: Go = { speak: () => setStep('recording'), write: () => setStep('typing'), cancel: () => setStep('cancelled'), check: () => setStep('checked'), send: () => setStep('sent') }
  const showBox = step === 'typing' || step === 'checked' || step === 'recording'
  return (
    <div className="flex flex-col items-start gap-2">
      <div className={`relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${phone ? 'w-[393px]' : 'w-[580px]'} ${step === 'sent' ? 'min-h-80' : ''}`}>
        {kind === 'md' ? <MdPlace phone={phone} step={step} go={go} /> : <WebPlace phone={phone} step={step} go={go} />}
        {showBox ? (
          <div className="mt-auto border-t border-zinc-200 dark:border-zinc-800">
            <Box kind={kind} step={step} phone={phone} />
          </div>
        ) : (
          <div className={`h-4 ${kind === 'web' ? 'bg-white' : ''}`} />
        )}
        {step === 'cancelled' ? (
          // the page's toast, as Esc on a recording says now (here in the scene, not over the screen)
          <div className="relative h-14 transform-gpu">
            <Toast toast={{ text: 'Recording discarded', error: false, sticky: false, action: { label: 'Undo' } }} place="inset-x-0 bottom-3 mx-auto" onAction={() => setStep('recording')} onClose={() => {}} />
          </div>
        ) : null}
      </div>
      <button data-proto="again" onClick={() => setStep(start)} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
        Start over
      </button>
    </div>
  )
}
