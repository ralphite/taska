// The microphone: whether this page can record, opening it as it hears (no echo cancelling, noise suppression or
// automatic gain), and what to say when it does not open.

import { micTrouble as troubleWords } from '../../model/micWords'

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

/** Why the microphone did not start, and what to do here (the desktop's way to allow it, or the phone's). */
export const micTrouble = (e: unknown, desk: boolean): string => troubleWords((e as Error)?.name || '', desk, window.isSecureContext)
