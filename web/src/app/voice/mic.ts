// The microphone: whether this page can record, opening it as it hears (no echo cancelling, noise suppression or
// automatic gain), and what to say when it does not open.

import { micTrouble as troubleWords } from '../../model/micWords'

export const canRecord = () => typeof window !== 'undefined' && window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.MediaRecorder === 'function'

const AS_IT_HEARS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as const

/** The microphone opened: its stream, why it could not open as it hears (null: it did), and what the browser says it
 * does to the sound (its echo cancelling, noise suppression, gain), for the developers' log (T745). */
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
  // T829: the first recording after the Home Screen app came back from the background was refused (NotAllowedError),
  // and the next press worked: refused, it is asked once more at once, so the press that started it records
  const ask = async (audio: MediaTrackConstraints | boolean): Promise<MediaStream> => {
    try {
      return await md.getUserMedia({ audio })
    } catch (e) {
      if ((e as Error)?.name !== 'NotAllowedError') throw e
      await new Promise((r) => setTimeout(r, AGAIN_MS))
      return md.getUserMedia({ audio })
    }
  }
  try {
    return await opened(await ask(AS_IT_HEARS), null)
  } catch (e) {
    const name = (e as Error)?.name || 'Error'
    if (name === 'NotAllowedError' || name === 'SecurityError') throw e
    return opened(await ask(true), `${name}: ${(e as Error)?.message || ''}`.slice(0, 200))
  }
}

/** How long a refused microphone waits before it is asked once more (T829). */
export const AGAIN_MS = 300

/** The page's microphone, one for voice notes, dictation and search's listening: each recording opens it and lets it
 * go at its end, also from the Home Screen. Kept between recordings there (T800), iPhone kept its microphone light on
 * and, once Taska came back from the background, refused it until Taska was closed and opened again (r1370, as T333
 * saw): a recording that works comes first. */
export class Mic {
  constructor(private readonly d: { open?: () => Promise<OpenMic> } = {}) {}

  /** The microphone for a new recording. */
  open(): Promise<OpenMic> {
    return (this.d.open ?? openMic)()
  }

  /** A recording with `stream` ended: the microphone is let go. */
  done(stream: MediaStream | null | undefined): void {
    stream?.getTracks().forEach((t) => t.stop())
  }
}

/** Why the microphone did not start, and what to do here (the desktop's way to allow it, or the phone's). */
export const micTrouble = (e: unknown, desk: boolean): string => troubleWords((e as Error)?.name || '', desk, window.isSecureContext)

/** Stop recorder `rec` and get what it recorded: when it says it has stopped, or at once when it has stopped by itself
 * (the phone took the microphone away: the screen locked, a call). Asked to stop then, it would never say so again,
 * and the note would wait forever (T745). */
export function stopRecorder(rec: Pick<MediaRecorder, 'state' | 'mimeType' | 'stop' | 'addEventListener'>, chunks: Blob[]): Promise<Blob> {
  const whole = () => new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
  if (rec.state === 'inactive') return Promise.resolve(whole())
  return new Promise((done) => {
    rec.addEventListener('stop', () => done(whole()), { once: true })
    rec.stop()
  })
}

/** Keep the screen on while recording: a phone that locks itself takes the microphone away mid-note (T745). A page
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
