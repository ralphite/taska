// Whether this window is seen and in use, for the sync's pace (a window you are in waits for news, others ask now
// and then), and when you come back to it or the network does.

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
  watch: (on) => {
    const shown = () => {
      if (!document.hidden) on.back()
    }
    addEventListener('visibilitychange', shown)
    addEventListener('focus', on.back)
    addEventListener('online', on.online)
    return () => {
      removeEventListener('visibilitychange', shown)
      removeEventListener('focus', on.back)
      removeEventListener('online', on.online)
    }
  },
}
