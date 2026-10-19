import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

// No StrictMode: the page's model is plain objects that drawing reads (lib/state.ts); drawing twice on purpose
// would run its bookkeeping twice.
const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)
