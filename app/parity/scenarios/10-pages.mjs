// The project's other pages: Rules, Archive, Inputs, Documents, Activity, Deleted, and the Settings sections.
const SETTINGS = ['agents', 'projects', 'phone', 'notifications', 'spellings', 'organizer']
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
      await t.goto('/dev/dashboard')
    },
  },
  {
    id: 'settings',
    title: '设置的每一节',
    async run(t) {
      for (const s of SETTINGS) await t.goto(`/p/taska/${s}`)
      await t.click((p) => p.getByRole('link', { name: /^Voice spellings/ }), '点 Voice spellings')
      await t.click((p) => p.getByRole('link', { name: /^Projects/ }), '点 Projects')
    },
  },
]
