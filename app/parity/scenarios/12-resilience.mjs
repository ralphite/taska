// When things go wrong: Taska stops and comes back; two tabs of one browser stay in step.
export default [
  {
    id: 'server-down',
    untimed: true,
    title: 'Taska 停了又回来',
    async run(t) {
      await t.goto('/p/taska/')
      await t.servers(false, 'Taska 停了')
      await t.wait(4000, '等 4 秒')
      await t.click((p) => p.getByRole('textbox', { name: 'Input' }), '点输入框')
      await t.type('Parity: written while Taska was down', '打字')
      if (t.desk) await t.key('Meta+Enter', '按 ⌘↵ 发送')
      else await t.click((p) => p.getByRole('button', { name: /^Send/ }), '点发送')
      await t.wait(3000, '再等 3 秒')
      await t.servers(true, 'Taska 回来了')
      await t.wait(6000, '等它自己连上')
      await t.agent('GET', '/p/taska/inbox')
    },
  },
  {
    id: 'two-tabs',
    title: '同一个浏览器开两个标签页',
    async run(t) {
      await t.goto('/p/taska/')
      await t.newTab('/p/taska/B533')
      await t.click((p) => p.getByRole('button', { name: /^Approve/ }), '第二个标签页里点 Approve')
      await t.tab(0, '回到第一个标签页')
      await t.wait(2000, '等它跟上')
      await t.agent('POST', '/p/taska/do?by=claude-code', 'B498 say Parity: seen in both tabs\n')
      await t.waitText('Parity: seen in both tabs', '第一个标签页等 agent 的话', 6000)
      await t.tab(1, '第二个标签页')
    },
  },
]
