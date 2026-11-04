// What the page says when the microphone does not work, and where a cancelled recording went. The way to allow the
// microphone differs on the desktop (Chrome's site settings) and the phone (Safari's); voice notes, dictation and
// search all say it the same way. Short words, no full stops. Pure.

/** Where to allow the microphone for this site. */
export const micAllow = (desk: boolean) => (desk ? 'Chrome: the icon left of the address › Microphone' : 'Safari: aA › Website Settings › Microphone')

/** The browser has no way to record (no MediaRecorder, or not over HTTPS). */
export const CANT_RECORD = "This browser can't record"

/** Why the microphone did not start (`name`: the error's name), and what to do. */
export function micTrouble(name: string, desk: boolean, secure: boolean): string {
  if (!secure) return 'The microphone needs HTTPS: open Taska by its https link'
  if (name === 'NotAllowedError' || name === 'SecurityError') return `Microphone not allowed · ${micAllow(desk)}`
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found'
  if (name === 'NotReadableError' || name === 'AbortError') return 'Microphone busy (a call, an app or a tab) · stop it and try again'
  return `The microphone did not start (${name || 'unknown error'}) · try again`
}

/** A recording that heard nothing at all. */
export const noSound = (desk: boolean) => `No sound from the microphone · check ${desk ? 'System Settings › Privacy & Security › Microphone' : 'Settings › Apps › Safari › Microphone'}`

/** A recording cancelled with Esc: kept with the inputs, in New input's list on the desktop, Inputs on the phone. */
export const cancelledKept = (desk: boolean) => `Recording cancelled · kept in ${desk ? 'New input' : 'Inputs'}`
