// The page's services and its layout, handed down through React context: containers read them; presentational
// components get props only.

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type { App } from './createApp'

const AppContext = createContext<App | null>(null)

export function AppProvider({ app, children }: { app: App; children: ReactNode }) {
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>
}

export function useApp(): App {
  const app = useContext(AppContext)
  if (!app) throw new Error('useApp outside AppProvider')
  return app
}

/** A value from one of the app's stores; the component draws again when it changes. */
export function useStoreValue<S, T>(store: StoreApi<S>, select: (s: S) => T): T {
  return useStore(store, select)
}

export type Layout = 'desk' | 'phone'
const LayoutContext = createContext<Layout>('desk')

export function LayoutProvider({ layout, children }: { layout: Layout; children: ReactNode }) {
  return <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>
}

/** The desktop's layout or the phone's: from the window (or a story's frame). */
export const useLayout = () => useContext(LayoutContext)

const DESK = '(min-width: 1024px)'

/** The window's layout, following its width. */
export function useWindowLayout(): Layout {
  return useSyncExternalStore(
    (fn) => {
      const mq = matchMedia(DESK)
      mq.addEventListener('change', fn)
      return () => mq.removeEventListener('change', fn)
    },
    () => (matchMedia(DESK).matches ? 'desk' : 'phone'),
    () => 'desk',
  )
}
