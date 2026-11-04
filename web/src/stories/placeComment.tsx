// Commenting on a place picked in a page (B498), as the page draws it: a Markdown paragraph or a part of a web page,
// on the desktop or the phone, at each step. The document is the page's own (docAt: factsOf, DocView, BlockActs,
// WebPage, the control in ui/PlaceVoice), the box under it the page's own (boxAt: boxRole, shownBox, Composer), and
// the toast the page's Toast. Used by Document › Commenting › Voice and words on a place.
import type { ReactNode } from 'react'
import { LayoutProvider } from '../app/context'
import { Toast } from '../features/feedback/Toast'
import type { Doc } from '../model/types'
import { VOICE, boxAt } from './boxFixtures'
import { comment, doc } from './docFixtures'
import { docAt, type DocHere } from './docPage'

export type Step = 'picked' | 'recording' | 'checked' | 'sent' | 'cancelled' | 'typing'
export type Kind = 'md' | 'web'

/** what is said about each place, and the place's words */
const SAID: Record<Kind, string> = { md: 'How long does this step take?', web: 'Can 410 ms be any faster?' }
const QUOTE: Record<Kind, string> = { md: 'Apply the current filter when writing the file.', web: 'Write CSV 410 ms' }
const KEY: Record<Kind, string> = { md: 'k1', web: "h:[id='w3']" }

const MD_BLOCKS: Doc['blocks'] = [
  { key: 'title', kind: 'heading', text: '# Export plan', comments: [] },
  { key: 'i', kind: 'para', text: 'Two ways to ship filtered export, and what each costs.', comments: [] },
  { key: 'k1', kind: 'para', text: `${QUOTE.md} The file then holds what you see in the list, and the server need not change.`, comments: [] },
  { key: 'k2', kind: 'para', text: 'Option B saves filters on the server and ships next week.', comments: [] },
]
const bar = (id: string, label: string, w: number, ms: string) =>
  `<div id="${id}" style="display:grid;grid-template-columns:84px 1fr 52px;gap:10px;align-items:center;font-size:13px">${label}<div style="height:12px;border-radius:6px;background:#f4f4f5;overflow:hidden"><div style="height:100%;width:${w}%;background:#3b82f6;border-radius:6px"></div></div>${ms}</div>`
const WEB_MD = `<!doctype html><html><body style="font:15px/1.4 system-ui;margin:0;padding:20px 32px 12px;color:#18181b">
<div style="font-size:17px;font-weight:600;margin-bottom:12px">Where the time goes</div>
<div style="display:flex;flex-direction:column;gap:8px">${bar('w1', 'Read list', 72, '720 ms')}${bar('w2', 'Apply filter', 18, '180 ms')}${bar('w3', 'Write CSV', 41, '410 ms')}</div>
<div style="font-size:17px;font-weight:600;margin-top:96px">Options</div>
<div style="margin-top:8px;border:1px solid #e4e4e7;border-radius:12px;padding:12px;font-size:13px;color:#52525b">A · Filter on export: apply the current filter when writing the file.</div></body></html>`

/** The document at this step: after ↑, with the comment on its place. */
function docOf(kind: Kind, sent: boolean): Doc {
  const c = sent ? [comment({ id: 9101, key: KEY[kind], th: 9101, quote: kind === 'web' ? QUOTE.web : '', text: SAID[kind], by: 'you' })] : []
  if (kind === 'md') return doc({ d: 1, n: 12, title: 'Export plan', blocks: MD_BLOCKS.map((b) => (b.key === 'k1' ? { ...b, comments: c } : b)), detached: [], whole: [], resolved: {} })
  return doc({ d: 2, n: 12, fmt: 'html', title: 'Where the time goes', md: WEB_MD, blocks: [{ key: KEY.web, kind: 'html', text: QUOTE.web, comments: c }], detached: [], whole: [], resolved: {} })
}

/** How the document is open at this step. */
function hereOf(kind: Kind, step: Step): DocHere {
  const place = kind === 'md' ? { sel: [KEY.md] } : { quote: { key: KEY.web, text: QUOTE.web } }
  if (step === 'sent') return { threads: [`${KEY[kind]}#9101`] }
  if (step === 'recording') return kind === 'md' ? { ...place, speaking: { key: KEY.md, bar: false } } : { ...place, spoken: { key: KEY.web, text: QUOTE.web } }
  return { ...place, typing: step === 'typing' }
}

/** The box under the document: the desktop's always; the phone's only to write (B643, B498). */
function boxOf(kind: Kind, step: Step, desk: boolean): ReactNode {
  const at = kind === 'md' ? 'D1' : 'D2'
  const quote = { key: KEY[kind], text: QUOTE[kind] }
  if (!desk) return step === 'typing' ? boxAt({ at, quote }, false) : null
  if (step === 'checked') return boxAt({ at, quote, text: SAID[kind], files: [{ ...VOICE, ms: 3000, tr: SAID[kind] }] }, true)
  if (step === 'typing') return boxAt({ at, quote }, true)
  return boxAt({ at }, true)
}

/** One step: the document open with the place, the box under it, and the toast an ✕ leaves. */
export function PlaceStep({ kind, desk, step }: { kind: Kind; desk: boolean; step: Step }) {
  const box = boxOf(kind, step, desk)
  return (
    <div
      data-layout={desk ? 'desk' : 'phone'}
      style={{ width: desk ? 900 : 393, height: desk ? 520 : 600, transform: 'translateZ(0)' }}
      className="@container/frame relative flex flex-col overflow-hidden bg-white text-zinc-900 antialiased ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <LayoutProvider layout={desk ? 'desk' : 'phone'}>
        <div className="relative min-h-0 flex-1">{docAt(docOf(kind, step === 'sent'), desk, hereOf(kind, step))}</div>
        {box ? <div className="relative z-50 border-t border-zinc-200 dark:border-zinc-800">{box}</div> : null}
        {step === 'cancelled' ? <Toast toast={{ text: 'Recording discarded', error: false, sticky: false, action: { label: 'Undo' } }} place="inset-x-0 bottom-6 mx-auto" onAction={() => {}} onClose={() => {}} /> : null}
      </LayoutProvider>
    </div>
  )
}
