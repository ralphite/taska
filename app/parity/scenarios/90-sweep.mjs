// The long sweeps (run only when named): every item and every document of every project opened in turn, so every
// way the real data shows (Markdown, pictures, threads, choices, long titles) is compared at least once.
const PROJECTS = ['home', 'xiaoming-laptop', 'macstudio', 'taska', 'lumina', 'nextjob', 'todos', 'notif', 'dev2']
const codes = (text) => [...text.matchAll(/^([FBITR]\d+) /gm)].map((m) => m[1])

export default [
  {
    id: 'sweep-items',
    title: '巡查：每个项目的每个事项',
    optIn: true,
    variants: ['desk-light', 'phone-light', 'desk-dark', 'phone-dark', 'iphone-light'],
    async run(t) {
      for (const proj of PROJECTS) {
        const list = await t.agent('GET', `/p/${proj}/items?status=all&archived=all&limit=5000`, null, `${proj} 的全部事项`)
        await t.goto(`/p/${proj}/`)
        for (const c of codes(list)) await t.goto(`/p/${proj}/${c}`, `${proj} ${c}`)
      }
    },
  },
  {
    id: 'sweep-docs',
    title: '巡查：每个项目的每个文档',
    optIn: true,
    variants: ['desk-light', 'phone-light', 'desk-dark', 'phone-dark', 'iphone-light'],
    async run(t) {
      for (const proj of PROJECTS) {
        await t.goto(`/p/${proj}/docs`, `${proj} 的文档列表`)
        const text = await t.A.page.evaluate(() => document.body.innerText)
        const docs = [...new Set([...text.matchAll(/\bD(\d+)\b/g)].map((m) => +m[1]))].sort((a, b) => a - b)
        for (const d of docs) await t.goto(`/p/${proj}/D${d}`, `${proj} D${d}`)
      }
    },
  },
]
