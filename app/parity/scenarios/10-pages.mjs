// The project's other pages: Rules, Archive, Inputs, Documents, Activity, Deleted, and the Settings sections.
const SETTINGS = ['agents', 'projects', 'phone', 'notifications', 'spellings', 'organizer']
const KEY = { mask: (p) => [p.getByText(/^[a-z0-9]{4}-[a-z0-9]{4}$/)], text: [/^[a-z0-9]{4}-[a-z0-9]{4}$/gm, /(text|code): [a-z0-9]{4}-[a-z0-9]{4}$/gm] }
export default [
  {
    id: 'pages',
    title: '规则、归档、输入、文档、动态、已删除',
    async run(t) {
      for (const p of ['rules', 'archive', 'inputs', 'docs', 'log', 'deleted', 'new', 'D39', 'R1', 'settings'])
        await t.goto(`/p/taska/${p}`)
      await t.goto('/p/lumina/')
      await t.goto('/p/dev2/')
      await t.goto('/p/nosuchproject/')
      await t.goto('/p/taska/B9999')
      // (the dev dashboard shows how fast this server answered during the run: it differs by the machine's load, so
      // it is left out)
    },
  },
  {
    id: 'settings',
    title: '设置的每一节',
    async run(t) {
      for (const s of SETTINGS)
        // each Taska makes its own key for phones: the key is painted over and left out of the text
        await t.goto(`/p/taska/${s}`, undefined, s === 'phone' ? { env: KEY } : {})
      await t.goto('/p/taska/settings')
      await t.click((p) => p.getByRole('link', { name: /^Voice spellings/ }), '点 Voice spellings')
      if (t.phone) await t.back('后退')
      await t.click((p) => p.getByRole('link', { name: /^Projects/ }), '点 Projects')
    },
  },
]
