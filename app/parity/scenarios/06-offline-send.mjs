// Writing while the network is down: what the page shows, and that it goes out once, by itself, when it is back.
export default [
  {
    id: 'offline-send',
    untimed: true,
    title: '断网时发送',
    async run(t) {
      await t.goto('/p/taska/')
      await t.click((p) => p.getByRole('textbox', { name: 'Input' }), '点输入框')
      await t.offline(true, '断网')
      await t.type('Parity: written while offline', '断网时打字')
      if (t.desk) await t.key('Meta+Enter', '按 ⌘↵ 发送')
      else await t.click((p) => p.getByRole('button', { name: /^Send/ }), '点发送')
      await t.wait(3000, '断网中等 3 秒')
      await t.offline(false, '恢复网络')
      await t.wait(4000, '恢复后等 4 秒')
      await t.agent('GET', '/p/taska/inbox')
      await t.reload('刷新')
    },
  },
]
