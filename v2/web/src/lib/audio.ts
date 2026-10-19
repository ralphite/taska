// Voice notes play in place: one player for the page; each chip shows play or pause and the time.
import { bump } from './state'
import { toast } from './toast'

export const AUD = { el: null as HTMLAudioElement | null, src: '' }
export function playAudio(src: string) {
  if (AUD.src === src && AUD.el && !AUD.el.paused) return AUD.el.pause()
  if (AUD.src !== src || !AUD.el) {
    AUD.el?.pause()
    AUD.el = new Audio(src)
    AUD.src = src
    for (const ev of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata'])
      AUD.el.addEventListener(ev, () => bump('detail', 'dialog', 'inputs'))
  }
  AUD.el.play().catch(() => toast('Could not play this recording'))
}
/** What a chip for this recording shows: playing or not, and the time in ms (null: not known yet). */
export function audioOf(src: string): { playing: boolean; t: number | null } {
  const a = AUD.el
  if (!a || AUD.src !== src) return { playing: false, t: null }
  const playing = !a.paused,
    d = a.duration
  const t = playing || (a.currentTime && !a.ended) ? a.currentTime : isFinite(d) ? d : null // recorded webm often has no length until played through
  return { playing, t: t === null ? null : 1000 * t }
}
