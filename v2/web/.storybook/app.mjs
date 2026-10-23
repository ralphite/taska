// T457: after the page and Storybook are built, the stories' copy of the page: the same index.html, with the shim
// that feeds it the saved answers loaded first.
// T456 (r678, r679): with --dev, the copy Storybook's own server gives (.storybook/public/app.html, at
// /storybook/app.html): the page from the source through that server, so a change in the code shows at once.
import { readFileSync, writeFileSync } from 'node:fs'

const shim = '<head><script src="/storybook/app-shim.js"></script>'
if (process.argv.includes('--dev')) {
  const live = `  <script type="module">
      import RefreshRuntime from '/@react-refresh'
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>
    <script type="module" src="/@vite/client"></script>
  </head>`
  const html = readFileSync('index.html', 'utf8')
    .replace('<head>', shim)
    .replace(/\s*<link rel="manifest"[^>]*>/, '')
    .replace('</head>', live)
  writeFileSync('.storybook/public/app.html', html)
} else {
  const out = process.argv[2] || 'dist' // where the page was built
  const html = readFileSync(`${out}/index.html`, 'utf8').replace('<head>', shim)
  writeFileSync(`${out}/storybook/app.html`, html)
}
