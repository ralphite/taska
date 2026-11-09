// The parts of an item's page above its talk: its chips (status, priority, type, Later, archived, where it came from,
// what it is part of), its editor (title, details, next step) and its subitems with the field to add one. Props only.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { closed } from '../../model/items'
import { shownStatus } from '../../model/needStates'
import type { Item } from '../../model/types'
import { SectionHead, Soft } from '../../ui/bits'
import { Icon, StateIcon } from '../../ui/Icon'
import { overflows } from '../../ui/scroller'
import { CHIP, FIELD, NEED, PRIMARY, SECOND, TYPE_TEXT } from '../../ui/tones'
import type { ItemEvents, ItemFacts } from './ItemPage'

const caret = <Icon n="down" c="size-3 opacity-50 group-data-ro/item:hidden" sw="2.25" /> // none read only (data-ro)

export function Chips({ it, f, on }: { it: Item; f: ItemFacts; on: ItemEvents }) {
  const shown = shownStatus(it)
  return (
    <>
      <button
        title="Status · S"
        onClick={(e) => on.menu('s', e.currentTarget)}
        className={`${CHIP} shrink-0 lg:min-w-32 ${shown.s === 'wait' ? `font-semibold ${NEED.answer.text}` : 'text-zinc-700 dark:text-zinc-200'}`}
      >
        <StateIcon {...shown} cls="size-3.5" />
        {shown.label}
        {caret}
      </button>
      {(
        <button
          title="Priority · P"
          onClick={(e) => on.menu('p', e.currentTarget)}
          className={`${CHIP} shrink-0 ${it.pri === 'P0' ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-zinc-700 dark:text-zinc-200'}`}
        >
          {it.pri}
          {caret}
        </button>
      )}
      {(
        <button title="Type · T" onClick={(e) => on.menu('t', e.currentTarget)} className={`${CHIP} shrink-0 text-zinc-700 dark:text-zinc-200`}>
          {it.type[0].toUpperCase() + it.type.slice(1)}
          {caret}
        </button>
      )}
      {closed(it.status) || (
        <button title="Later · L" onClick={(e) => on.later(e.currentTarget)} className={`${CHIP} shrink-0 text-zinc-700 dark:text-zinc-200`}>
          <Icon n="clock" c="size-3.5 opacity-60" />
          {it.when === 'later' ? (f.laterOn ? `Later · ${f.laterOn}` : 'Later') : 'Now'}
          {caret}
        </button>
      )}
      {it.archived ? (
        <span className={`${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300`}>
          <Icon n="archive" c="size-3.5 opacity-60" />
          Archived
        </span>
      ) : null}
      {f.sources ? (
        <button onClick={on.sources} className={`${CHIP} shrink-0 text-zinc-600 dark:text-zinc-300`}>
          {f.sources === 1 ? 'From 1 input' : `From ${f.sources} inputs`}
        </button>
      ) : null}
      {f.parent ? (
        <button onClick={() => on.goto((f.parent as Item).n)} className={`${CHIP} min-w-0 flex-1 basis-32 text-zinc-700 dark:text-zinc-300`}>
          <Icon n="link" c="size-3.5 opacity-60" />
          <span className="truncate">
            <span className="mr-1 text-zinc-500 dark:text-zinc-400">Part of</span>
            <span className={`mr-1 font-mono font-bold ${TYPE_TEXT[f.parent.type]}`}>{f.code(f.parent.n)}</span>
            {f.parent.title}
          </span>
        </button>
      ) : null}
    </>
  )
}

export function Editor({ it, kept, on }: { it: Item; kept: { title: string; body: string; next: string } | null; on: ItemEvents }) {
  const [title, setTitle] = useState(kept?.title ?? it.title)
  const [body, setBody] = useState(kept?.body ?? it.body)
  const [next, setNext] = useState(kept?.next ?? it.next)
  const details = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    // write on after the details, not before them
    const t = details.current
    if (!t) return
    t.focus()
    t.selectionStart = t.selectionEnd = t.value.length
  }, [])
  return (
    <div className="flex flex-col gap-2">
      <input
        className={`${FIELD} font-medium`}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          on.editTyped({ title: e.target.value, body, next })
        }}
        aria-label="Title"
      />
      <textarea
        ref={details}
        rows={8}
        className={`${FIELD} leading-relaxed`}
        aria-label="Details"
        placeholder="Details"
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          on.editTyped({ title, body: e.target.value, next })
        }}
      />
      <input
        className={FIELD}
        value={next}
        onChange={(e) => {
          setNext(e.target.value)
          on.editTyped({ title, body, next: e.target.value })
        }}
        aria-label="Next step"
        placeholder="Next step"
      />
      <div className="flex justify-end gap-2">
        <button onClick={on.editCancel} className={SECOND}>
          Cancel
        </button>
        <button onClick={() => on.editSave({ title, body, next })} className={PRIMARY}>
          Save
        </button>
      </div>
    </div>
  )
}

/** A field fully in sight in the part that scrolls it, above the fade at that part's end. */
function inSight(f: HTMLElement) {
  let sc = f.parentElement
  while (sc && !(sc.scrollHeight > sc.clientHeight && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement
  if (!sc) return
  const r = f.getBoundingClientRect()
  const c = sc.getBoundingClientRect()
  const fade = overflows(sc) ? 72 : 8 // the part fades over its last 4rem while there is more below
  if (r.bottom > c.bottom - fade) sc.scrollTop += r.bottom - (c.bottom - fade)
  else if (r.top < c.top) sc.scrollTop -= c.top - r.top + 8
}

export function Subitems({ it, f, on }: { it: Item; f: ItemFacts; on: ItemEvents }) {
  const [title, setTitle] = useState(f.subDraft ?? '')
  const field = useRef<HTMLInputElement>(null)
  const added = useRef(true) // opened: the field comes into sight; then after each one added
  const kids = f.kids
  useLayoutEffect(() => {
    if (!added.current || !field.current) return
    added.current = false
    inSight(field.current)
  }, [kids.length, f.addingSub])
  // the field stays for the next one
  const add = () => {
    if (!title.trim()) return
    added.current = true
    on.subAdd(title.trim())
    setTitle('')
  }
  return (
    <section className="flex flex-col gap-2">
      <SectionHead
        text={`Subitems${kids.length ? ` · ${kids.filter((k) => closed(k.status)).length}/${kids.length}` : ''}`}
        right={
          f.addingSub ? null : (
            <button onClick={on.subNew} className="-my-2.5 flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-600 group-data-ro/item:hidden hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10">
              <Icon n="plus" c="size-4" sw="2" />
              Add
            </button>
          )
        }
      />
      {kids.length ? (
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {kids.map((k) => (
            <button
              key={k.n}
              onClick={() => on.goto(k.n)}
              className={`flex w-full items-start gap-3 px-3 py-3 text-left first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-50 data-pressed:bg-zinc-100 dark:hover:bg-zinc-900 dark:data-pressed:bg-zinc-800 ${closed(k.status) ? 'opacity-55' : ''}`}
            >
              <StateIcon {...shownStatus(k)} />
              <span className="min-w-0 flex-1 text-[15px] leading-snug">
                <span className={`mr-1.5 font-mono text-[13px] font-bold ${TYPE_TEXT[k.type]}`}>{f.code(k.n)}</span>
                <span className={closed(k.status) ? 'line-through' : ''}>{k.title}</span>
              </span>
              {k.when === 'later' && !closed(k.status) ? (
                <span className="mt-0.5 flex shrink-0 text-xs font-medium">
                  <Soft>Later</Soft>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {f.addingSub ? (
        <div className="flex items-center gap-2">
          <input
            ref={field}
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              on.subTyped(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) add()
            }}
            className={`${FIELD} min-w-0 flex-1`}
            placeholder={`Subitem of ${f.code(it.n)}`}
            aria-label="Subitem title"
          />
          <button onClick={add} disabled={!title.trim()} className={PRIMARY}>
            Add
          </button>
          <button aria-label="Cancel" onClick={on.subCancel} className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Icon n="x" c="size-5" />
          </button>
        </div>
      ) : null}
    </section>
  )
}
