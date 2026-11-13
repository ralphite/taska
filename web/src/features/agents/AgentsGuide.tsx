// What agents read, in the Agents sheet: the guide an agent follows, laid out (its parts, its commands beside what
// they do, its example); its words are the agents', word for word. Props only.

import { guideParts, type GuidePart } from '../../model/guide'
import { Skeleton } from '../../ui/bits'

const CODE = 'rounded bg-zinc-100 px-1 font-mono text-[12.5px] dark:bg-zinc-800'

/** Words with `code` in them. */
function Words({ text }: { text: string }) {
  return <>{text.split('`').map((s, i) => (i % 2 ? <code key={i} className={CODE}>{s}</code> : s))}</>
}

function Part({ p }: { p: GuidePart }) {
  switch (p.kind) {
    case 'heading':
      return (
        <h3 className="pt-3 text-sm font-semibold first:pt-0">
          {p.text}
          {p.note ? <span className="font-normal text-zinc-500 dark:text-zinc-400"> {p.note}</span> : null}
        </h3>
      )
    case 'text':
      return (
        <p className="text-sm leading-relaxed wrap-anywhere text-zinc-700 dark:text-zinc-300">
          <Words text={p.text} />
        </p>
      )
    case 'rows':
      return (
        <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {p.rows.map((r, i) => (
            <div key={i} className="grid gap-1 py-2 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-4">
              <dt className="font-mono text-[12.5px] leading-5 break-words whitespace-pre-wrap">{r.cmd}</dt>
              <dd className="text-sm leading-5 wrap-anywhere text-zinc-600 dark:text-zinc-400">
                <Words text={r.say} />
              </dd>
            </div>
          ))}
        </dl>
      )
    case 'code':
      return <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-[12.5px] leading-relaxed wrap-anywhere whitespace-pre-wrap lg:scrollbar-thin dark:bg-zinc-800">{p.text}</pre>
  }
}

/** The guide agents read (`text`: null while it comes). */
export function AgentsGuide({ text }: { text: string | null }) {
  if (text == null) return <Skeleton shape="text" n={4} cls="pb-4" />
  return (
    <div className="flex flex-col gap-3 pb-4">
      {guideParts(text).map((p, i) => (
        <Part key={i} p={p} />
      ))}
    </div>
  )
}
