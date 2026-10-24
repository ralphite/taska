// What just happened, in one line, over the page: with a button for a few seconds (Undo, or another), red for an
// error. Props only; where it sits is the layout's (over the pane you acted in on the desktop, above the box on the
// phone).

import { Icon } from '../../ui/Icon'

export interface ToastView {
  text: string
  error: boolean
  sticky: boolean
  action: { label: string } | null
}

export function Toast({ toast, style, place, onAction, onClose }: {
  toast: ToastView | null
  style?: React.CSSProperties
  /** classes that place it (the layout's) */
  place: string
  onAction(): void
  onClose(): void
}) {
  const t = toast
  return (
    <div
      hidden={!t}
      role={t?.error ? 'alert' : 'status'}
      data-error={t?.error ? '' : undefined}
      style={style}
      className={`fixed z-[60] flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-zinc-900 py-2 pr-4 pl-4 text-sm text-white shadow-lg has-[button]:py-1.5 has-[button]:pr-1.5 data-error:bg-red-600 data-error:text-white lg:max-w-md dark:bg-zinc-100 dark:text-zinc-900 dark:data-error:bg-red-600 dark:data-error:text-white ${t?.action || t?.sticky ? '' : 'pointer-events-none'} ${place}`}
    >
      {t?.error ? <Icon n="alert" c="size-4" sw="2" /> : null}
      <span className="line-clamp-2 min-w-0 leading-snug">{t?.text}</span>
      {t?.action ? (
        <button
          onClick={(e) => (e.stopPropagation(), onAction())}
          className={`relative h-8 shrink-0 rounded-full px-3 text-sm font-semibold after:absolute after:-inset-1.5 ${t.error ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/15 text-white hover:bg-white/25 dark:bg-zinc-900/10 dark:text-zinc-900 dark:hover:bg-zinc-900/20'}`}
        >
          {t.action.label}
        </button>
      ) : null}
      {t?.sticky ? (
        <button
          aria-label="Close"
          onClick={(e) => (e.stopPropagation(), onClose())}
          className="relative grid size-8 shrink-0 place-items-center rounded-full text-white/80 after:absolute after:-inset-1.5 hover:bg-white/20 hover:text-white"
        >
          <Icon n="x" c="size-4" />
        </button>
      ) : null}
    </div>
  )
}
