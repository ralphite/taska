import { ICON, STATE_ICON, type IconName } from './icon-paths'

/** One of the page's icons, in a 24x24 box with a round stroke. */
export function Icon({ n, c = 'size-5', sw = '1.75' }: { n: IconName; c?: string; sw?: string }) {
  return (
    <svg
      className={`${c} shrink-0`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON[n] }}
    />
  )
}

/** Something under way: a faint ring with a turning arc. */
export function Spinner({ c = 'size-3' }: { c?: string }) {
  return (
    <svg className={`${c} shrink-0 animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

/** A status's round icon (or "wait": an agent's question waits on you), with its name for screen readers; without a
 * name it is only a picture beside words that say it (hidden from screen readers). */
export function StateIcon({ s, label, cls = 'mt-px size-5', tone }: { s: string; label?: string; cls?: string; tone?: string }) {
  const [path, t] = STATE_ICON[s] || STATE_ICON.open
  const named = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg
      className={`${cls} shrink-0 ${tone ?? t}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...named}
      dangerouslySetInnerHTML={{ __html: label ? `<title>${escapeHtml(label)}</title>${path}` : path }}
    />
  )
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

export type { IconName }
