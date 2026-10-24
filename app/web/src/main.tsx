import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './pages/App'
import { AppProvider } from './app/context'
import { createApp } from './app/createApp'
import { installPressFeedback } from './app/press'
import { windowPresence } from './app/presence'
import { BrowserCopyCache } from './sync/cache'
import { browserHistory } from './stores/route'
import { browserStore } from './stores/storage'
import { browserVault } from './stores/noteVault'

const app = createApp({
  kv: browserStore(),
  session: browserStore('session'),
  history: browserHistory(),
  presence: windowPresence,
  cache: new BrowserCopyCache(),
  vault: browserVault(),
  pageScript: (/\/assets\/(index-[\w-]+\.js)/.exec(document.querySelector<HTMLScriptElement>('script[type=module][src*="/assets/index-"]')?.src || '') || [])[1] || '',
  desk: () => matchMedia('(min-width: 1024px)').matches,
})
installPressFeedback()
// installable, the page kept so it opens fast (and while Taska restarts), where the phone's notifications arrive
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {})

const root = document.getElementById('root')
if (root)
  createRoot(root).render(
    <StrictMode>
      <AppProvider app={app}>
        <App />
      </AppProvider>
    </StrictMode>,
  )
