// B629 version 2: a notebook of what was said. The list answers "what exactly did I say?": it reads as one document,
// newest first, each input a passage under its number and time, its pictures and voice note with it; what became of
// it is a quiet note in the margin (the desktop) or under the passage behind a thin line (the phone). No boxes, no
// bubbles, no row chrome: the words carry the page.
import { Acts, Became, Files, Head, Nothing, useList, Words, type Entry } from './inputsDemo'

function Passage({ e, desk, words, opened, toggle }: { e: Entry; desk: boolean; words: readonly string[]; opened: boolean; toggle(): void }) {
  const body = (
    <>
      <Words e={e} words={words} opened={opened} toggle={toggle} upTo="max-h-42" cls="text-[16px] leading-7 text-zinc-900 dark:text-zinc-100" />
      {e.r.files.length ? (
        <div className={e.r.text ? 'mt-3' : ''}>
          <Files r={e.r} size={desk ? 'size-20' : 'size-16'} />
        </div>
      ) : null}
    </>
  )
  if (desk)
    return (
      <article className="group/row relative grid grid-cols-[6.5rem_minmax(0,1fr)_15rem] gap-x-6 border-t border-zinc-100 py-5 first:border-t-0 dark:border-zinc-800/70">
        <div className="flex flex-col gap-0.5 pt-0.5">
          <span className="font-mono text-[17px] leading-6 font-bold text-zinc-900 dark:text-zinc-100">{e.code}</span>
          <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{e.when}</span>
        </div>
        <div className="min-w-0">{body}</div>
        <aside className="min-w-0 border-l border-zinc-200 pt-0.5 pl-4 dark:border-zinc-800">
          <Became o={e.out} />
        </aside>
        {/* in the margin under its number and time (into the padding below on a short passage): it covers no words */}
        <Acts e={e} desk at="absolute top-16 left-0 z-10" />
      </article>
    )
  return (
    <article className="border-t border-zinc-100 px-4 py-4 first:border-t-0 dark:border-zinc-800/70">
      <div className="flex min-h-6 items-center gap-2">
        <span className="font-mono text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{e.code}</span>
        <span className="text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">{e.when}</span>
        <span className="ml-auto flex">
          <Acts e={e} desk={false} />
        </span>
      </div>
      <div className="mt-1.5">{body}</div>
      <div className="mt-3 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
        <Became o={e.out} />
      </div>
    </article>
  )
}

export function Notebook({ desk, q0 = '' }: { desk: boolean; q0?: string }) {
  const { q, setQ, words, list, total, opened, toggle } = useList(q0)
  return (
    <div className="flex flex-col">
      <Head desk={desk} shown={list.length} total={total} q={q} setQ={setQ} />
      {list.length ? (
        <div className={`flex flex-col ${desk ? 'border-t border-zinc-200 dark:border-zinc-800' : 'border-t border-zinc-100 pb-6 dark:border-zinc-800'}`}>
          {list.map((e) => (
            <Passage key={e.r.id} e={e} desk={desk} words={words} opened={opened.has(e.r.id)} toggle={() => toggle(e.r.id)} />
          ))}
        </div>
      ) : (
        <Nothing q={q} />
      )}
    </div>
  )
}
