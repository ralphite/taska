// A proposal from an agent: Yadong approves one and declines another.
export default [
  {
    id: 'approve',
    title: '批准一个提议，拒绝另一个',
    async run(t) {
      await t.goto('/p/taska/B533')
      await t.agent('GET', '/p/taska/B533')
      await t.hover((p) => p.getByRole('button', { name: /^Approve/ }), '指着 Approve', { check: t.desk })
      await t.click((p) => p.getByRole('button', { name: /^Approve/ }), '点 Approve')
      await t.agent('GET', '/p/taska/B533')
      await t.agent('GET', '/p/taska/log?n=5')
      await t.goto('/p/lumina/B144')
      await t.click((p) => p.getByRole('button', { name: /^Won.t do/ }), '点 Won’t do')
      await t.agent('GET', '/p/lumina/B144')
      await t.goto('/p/taska/')
    },
  },
]
