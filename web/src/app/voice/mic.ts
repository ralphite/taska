// The microphone: whether this page can record, opening it as it hears (no echo cancelling, noise suppression or
// automatic gain), and what to say when it does not open.

import { micTrouble as troubleWords } from '../../model/micWords'

export const canRecord = () => typeof window !== 'undefined' && window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.MediaRecorder === 'function'

const AS_IT_HEARS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as const

/** The microphone opened: its stream, why it could not open as it hears (null: it did), and what the browser says it
 * does to the sound (its echo cancelling, noise suppression, gain), for the developers' log (B745). */
export interface OpenMic {
  stream: MediaStream
  refused: string | null
  settings: MediaTrackSettings
}

export async function openMic(): Promise<OpenMic> {
  const md = navigator.mediaDevices
  const opened = async (stream: MediaStream, refused: string | null): Promise<OpenMic> => {
    const track = stream.getAudioTracks()[0]
    // opened its usual way, it is asked once more to leave the sound alone
    if (refused && track?.applyConstraints) await track.applyConstraints(AS_IT_HEARS).catch(() => {})
    return { stream, refused, settings: track?.getSettings?.() ?? {} }
  }
  try {
    return await opened(await md.getUserMedia({ audio: AS_IT_HEARS }), null)
  } catch (e) {
    const name = (e as Error)?.name || 'Error'
    if (name === 'NotAllowedError' || name === 'SecurityError') throw e
    return opened(await md.getUserMedia({ audio: true }), `${name}: ${(e as Error)?.message || ''}`.slice(0, 200))
  }
}

/** Whether Taska runs from the Home Screen (an app of its own, not a browser tab). */
export const fromHomeScreen = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

/** The page's microphone (B217, B800). From the Home Screen the phone asks for it each time it is opened, so the
 * microphone it was given is kept between recordings while Taska is on screen (nothing is recorded or sent between
 * them) and let go when Taska goes to the background or away; in a browser tab each recording opens it and lets it go.
 * `busy`: a recording under way (the microphone stays while it lasts, on screen or not). */
export class Mic {
  private kept: MediaStream | null = null
  readonly stop: () => void
  constructor(
    private readonly d: { busy(): boolean; keep?: () => boolean; open?: () => Promise<OpenMic> },
  ) {
    if (typeof document === 'undefined') {
      this.stop = () => {}
      return
    }
    const away = () => document.visibilityState === 'hidden' && this.release()
    const gone = () => this.release()
    document.addEventListener('visibilitychange', away)
    window.addEventListener('pagehide', gone)
    this.stop = () => {
      document.removeEventListener('visibilitychange', away)
      window.removeEventListener('pagehide', gone)
      this.release(true)
    }
  }

  /** The microphone for a new recording: the one kept, while it still hears, else opened (and kept, from the Home
   * Screen). */
  async open(): Promise<OpenMic> {
    const k = this.kept
    const track = k?.getAudioTracks()[0]
    if (k && track?.readyState === 'live') return { stream: k, refused: null, settings: track.getSettings?.() ?? {} }
    this.kept = null
    const m = await (this.d.open ?? openMic)()
    if ((this.d.keep ?? fromHomeScreen)()) this.kept = m.stream
    return m
  }

  /** A recording with `stream` ended: it lets go of the microphone, unless it is the one kept (then only when Taska is
   * not on screen now). */
  done(stream: MediaStream | null | undefined): void {
    if (!stream) return
    if (stream !== this.kept) stream.getTracks().forEach((t) => t.stop())
    else if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this.release()
  }

  /** The kept microphone let go (not while a recording uses it, unless `now`). */
  private release(now = false): void {
    if (!this.kept || (!now && this.d.busy())) return
    this.kept.getTracks().forEach((t) => t.stop())
    this.kept = null
  }
}

/** Why the microphone did not start, and what to do here (the desktop's way to allow it, or the phone's). */
export const micTrouble = (e: unknown, desk: boolean): string => troubleWords((e as Error)?.name || '', desk, window.isSecureContext)

/** Stop recorder `rec` and get what it recorded: when it says it has stopped, or at once when it has stopped by itself
 * (the phone took the microphone away: the screen locked, a call). Asked to stop then, it would never say so again,
 * and the note would wait forever (B745). */
export function stopRecorder(rec: Pick<MediaRecorder, 'state' | 'mimeType' | 'stop' | 'addEventListener'>, chunks: Blob[]): Promise<Blob> {
  const whole = () => new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
  if (rec.state === 'inactive') return Promise.resolve(whole())
  return new Promise((done) => {
    rec.addEventListener('stop', () => done(whole()), { once: true })
    rec.stop()
  })
}

/** Keep the screen on while recording: a phone that locks itself takes the microphone away mid-note (B745). A page
 * that is hidden loses it, so it is asked for again when the page shows. Where the browser has none, nothing.
 * -> let go of it */
export function keepAwake(): () => void {
  let lock: WakeLockSentinel | null = null
  let on = true
  const ask = () => {
    const wl = navigator.wakeLock
    if (!wl || document.visibilityState !== 'visible' || (lock && !lock.released)) return
    wl.request('screen').then((l) => (on ? (lock = l) : void l.release().catch(() => {})), () => {})
  }
  ask()
  document.addEventListener('visibilitychange', ask)
  return () => {
    on = false
    document.removeEventListener('visibilitychange', ask)
    void lock?.release().catch(() => {})
    lock = null
  }
}
