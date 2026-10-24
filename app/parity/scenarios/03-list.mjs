// The item list: the views, groups that fold, scrolling, search.
export default [
  {
    id: 'list',
    title: '列表：视图、折叠、滚动、搜索',
    async run(t) {
      await t.goto('/p/taska/')
      for (const v of ['Needs you', 'All', 'Archive', 'Active'])
        await t.click((p) => p.getByRole('button', { name: new RegExp(`^${v} \\d`) }), `看 ${v}`)
      await t.click((p) => p.getByRole('button', { name: /^8 more finished/ }), '展开 8 more finished')
      await t.click((p) => p.getByRole('button', { name: 'Hide subitems' }).first(), '收起 F432 的子项')
      await t.wheel(t.desk ? { x: 450, y: 500 } : { x: 200, y: 450 }, 900, '列表往下滚')
      await t.wheel(t.desk ? { x: 450, y: 500 } : { x: 200, y: 450 }, -400, '列表往回滚一点')
      if (t.desk) {
        await t.click((p) => p.getByRole('searchbox', { name: '/' }), '点搜索框')
        await t.type('voice', '搜 voice')
        await t.key('Escape', '按 Esc 清掉搜索')
        await t.key('/', '按 / 回到搜索')
        await t.type('B533', '搜 B533')
        await t.key('Enter', '按 Enter')
      } else {
        await t.click((p) => p.getByRole('button', { name: 'Search' }), '点搜索')
        await t.type('voice', '搜 voice')
        await t.back('后退关掉搜索')
      }
      await t.agent('GET', '/p/taska/items')
      await t.agent('GET', '/p/taska/items?status=all&archived=all&limit=400')
    },
  },
]
