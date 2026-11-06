// An input gone to: its row comes into view, lit up for a moment (the row's own colour change fades it).

import { useLayoutEffect, useRef } from 'react'

export function useLitRow<T extends HTMLElement>(lit: boolean) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    if (lit) requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'center' }))
  }, [lit])
  return ref
}
