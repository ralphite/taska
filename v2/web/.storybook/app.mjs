// T457: after the page and Storybook are built, the stories' copy of the page: the same index.html, with the shim
// that feeds it the saved answers loaded first.
import { readFileSync, writeFileSync } from 'node:fs'

const out = process.argv[2] || 'dist' // where the page was built

const html = readFileSync(`${out}/index.html`, 'utf8').replace(
  '<head>',
  '<head><script src="/storybook/app-shim.js"></script>',
)
writeFileSync(`${out}/storybook/app.html`, html)
