import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { AppProvider } from './app/context'
import { createApp } from './app/createApp'
import { installPressFeedback } from './app/press'
import { windowPresence } from './app/presence'
import { BrowserCopyCache } from './sync/cache'
import { browserHistory } from './stores/route'
import { browserStore } from './stores/storage'

const app = createApp({
  kv: browserStore(),
  session: browserStore('session'),
  history: browserHistory(),
  presence: windowPresence,
  cache: new BrowserCopyCache(),
  desk: () => matchMedia('(min-width: 1024px)').matches,
})
installPressFeedback()

const root = document.getElementById('root')
if (root)
  createRoot(root).render(
    <StrictMode>
      <AppProvider app={app}>
        <App />
      </AppProvider>
    </StrictMode>,
  )
