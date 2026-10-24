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

/** A status's round icon (or "wait": an agent's question waits on you), with its name for screen readers. */
export function StateIcon({ s, label, cls = 'mt-px size-5', tone }: { s: string; label?: string; cls?: string; tone?: string }) {
  const [path, t] = STATE_ICON[s] || STATE_ICON.open
  return (
    <svg
      className={`${cls} shrink-0 ${tone ?? t}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: `<title>${escapeHtml(label ?? '')}</title>${path}` }}
    />
  )
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

export type { IconName }
