// The microphone: whether this page can record, opening it as it hears (no echo cancelling, noise suppression or
// automatic gain), and what to say when it does not open.

export const canRecord = () => typeof window !== 'undefined' && window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.MediaRecorder === 'function'

export async function openMic(): Promise<MediaStream> {
  const md = navigator.mediaDevices
  try {
    return await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  } catch (e) {
    if ((e as Error)?.name === 'NotAllowedError' || (e as Error)?.name === 'SecurityError') throw e
    return md.getUserMedia({ audio: true })
  }
}

/** Why the microphone did not start, and what to do. */
export function micTrouble(e: unknown): string {
  const name = (e as Error)?.name || ''
  if (!window.isSecureContext) return 'Microphone requires HTTPS: open Taska using its https link.'
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access denied. Allow it for this site (Safari: aA › Website Settings › Microphone), then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found'
  if (name === 'NotReadableError' || name === 'AbortError') return 'Microphone busy (call, app, or tab). Stop the other use and try again'
  return `The microphone did not start (${name || 'unknown error'}). Try again.`
}
