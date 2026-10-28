// A document's editor: its text, the first line its title, with Speak (words go where the caret is), Discard and Save
// (Create for a new one). Leaving it without saving keeps the text as a draft. Props only.

import { Icon } from '../../ui/Icon'
import { PRIMARY } from '../../ui/tones'

export interface DocEditEvents {
  change(text: string): void
  discard(): void
  save(): void
  mic(): void
}

export function DocEdit({ isNew, text, hint, mic, fieldRef, on }: { isNew: boolean; text: string; hint: string; mic: { on: boolean; text: string }; /** where you write, for Speak (its words go at the caret) */ fieldRef?: (el: HTMLTextAreaElement | null) => void; on: DocEditEvents }) {
  return (
    <div className="flex min-h-full flex-col">
      {/* on the phone the hint has a line of its own under the buttons, not a narrow column beside them */}
      <div className="sticky -top-2 z-10 -mx-4 -mt-2 mb-2 flex flex-wrap items-center gap-2 bg-white px-4 py-2 text-xs text-zinc-500 dark:bg-zinc-900">
        <span className="min-w-0 flex-1 max-lg:order-last max-lg:basis-full">{hint}</span>
        <button
          onClick={on.mic}
          {...(mic.on ? { 'data-on': '' } : {})}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-zinc-600 tabular-nums hover:bg-zinc-100 data-on:bg-red-600 data-on:text-white data-on:hover:bg-red-700 max-lg:mr-auto dark:text-zinc-300 dark:hover:bg-zinc-800 dark:data-on:bg-red-600 dark:data-on:text-white"
        >
          <Icon n="mic" />
          <span>{mic.text}</span>
        </button>
        <button onClick={on.discard} className="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Discard
        </button>
        <button onClick={on.save} className={PRIMARY}>
          {isNew ? 'Create' : 'Save'}
        </button>
      </div>
      <textarea
        ref={fieldRef}
        autoFocus
        value={text}
        onChange={(e) => on.change(e.target.value)}
        placeholder={'Title on the first line\n\nNotes, plans, or designs (Markdown supported)'}
        className="min-h-[40dvh] w-full flex-1 resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-zinc-400"
      />
    </div>
  )
}
