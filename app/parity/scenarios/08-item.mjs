// An item's page: changing its fields from the pills and the header, the toast and Undo, the next/previous item.
export default [
  {
    id: 'item-fields',
    title: '事项页：改优先级、状态、稍后，撤销',
    async run(t) {
      await t.goto('/p/taska/B498')
      await t.click((p) => p.getByRole('button', { name: 'P1', exact: true }).first(), '点优先级 P1')
      if (t.desk) {
        // captured as soon as it is still: the toast goes after a few seconds
        await t.click((p) => p.getByRole('dialog').getByRole('button', { name: /^P2/ }), '选 P2', { settle: { quiet: 300 } })
        // Z undoes the last change (T113 A7); the toast's Undo may be gone by the time a busy machine has compared
        await t.key('z', '按 Z 撤销')
      } else {
        await t.click((p) => p.getByRole('dialog').getByRole('button', { name: /^P2/ }), '选 P2', { settle: { quiet: 300 } })
        await t.click((p) => p.getByRole('button', { name: 'Undo' }), '点提示条上的 Undo')
      }
      await t.click((p) => p.getByRole('button', { name: 'Bug', exact: true }).first(), '点类型 Bug')
      await t.key('Escape', '按 Esc 关掉')
      if (t.desk) {
        await t.click((p) => p.getByRole('button', { name: 'Later', exact: true }).first(), '点 Later')
        await t.click((p) => p.getByRole('button', { name: 'Next', exact: true }), '下一个事项')
        await t.click((p) => p.getByRole('button', { name: 'Previous', exact: true }), '上一个事项')
        await t.click((p) => p.getByRole('button', { name: 'Item actions' }), '打开事项菜单')
        await t.key('Escape', '按 Esc 关掉菜单')
        await t.click((p) => p.getByRole('button', { name: 'Full width' }), '全宽')
        await t.key('Escape', '按 Esc')
      } else {
        await t.click((p) => p.getByRole('button', { name: /^More|Item actions/ }).first(), '打开事项菜单')
        await t.back('后退关掉菜单')
        await t.back('后退回列表')
      }
      await t.agent('GET', '/p/taska/B498')
    },
  },
]
