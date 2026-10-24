// Whether this window is seen and in use, for the sync's pace: a window you are in waits for news, others ask now
// and then.

import type { Presence } from '../sync/projectSync'

export const windowPresence: Presence = {
  hidden: () => document.hidden,
  focused: () => document.hasFocus(),
  nap: (ms) =>
    new Promise<void>((ok) => {
      const done = () => {
        clearTimeout(t)
        removeEventListener('visibilitychange', done)
        removeEventListener('focus', done)
        ok()
      }
      const t = setTimeout(done, ms)
      addEventListener('visibilitychange', done)
      addEventListener('focus', done)
    }),
  blurred: (signal) =>
    new Promise<void>((ok) => {
      const done = () => {
        removeEventListener('blur', done)
        ok()
      }
      addEventListener('blur', done)
      signal.addEventListener('abort', () => removeEventListener('blur', done))
    }),
}
