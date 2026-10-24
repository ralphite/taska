// The sidebar (desktop) and the projects drawer (phone): moving between projects and to the project's pages.
export default [
  {
    id: 'sidebar',
    title: '侧栏：切换项目和页面',
    async run(t) {
      await t.goto('/p/taska/')
      if (t.desk) {
        await t.hover((p) => p.getByRole('link', { name: /^lumina / }), '指着侧栏的 lumina')
        await t.click((p) => p.getByRole('link', { name: /^lumina / }), '点侧栏的 lumina')
        await t.click((p) => p.getByRole('link', { name: 'Documents', exact: true }), '点 Documents')
        await t.click((p) => p.getByRole('link', { name: 'Activity', exact: true }), '点 Activity')
        await t.click((p) => p.getByRole('link', { name: 'Deleted', exact: true }), '点 Deleted')
        await t.click((p) => p.getByRole('button', { name: /^Settings/ }), '点 Settings')
        await t.click((p) => p.getByRole('link', { name: /^Projects \d/ }), '设置里点 Projects')
        await t.key('Escape', '按 Esc 回到列表')
        await t.click((p) => p.getByRole('link', { name: /^taska / }), '点侧栏的 taska')
        await t.click((p) => p.getByRole('button', { name: 'Hide the sidebar' }), '收起侧栏')
        await t.reload('收起后刷新')
        await t.click((p) => p.getByRole('button', { name: 'Show the sidebar' }), '展开侧栏')
        await t.back('后退')
      } else {
        await t.click((p) => p.getByRole('button', { name: 'Projects and settings' }), '打开项目抽屉')
        await t.click((p) => p.getByRole('link', { name: /^lumina/ }), '点抽屉里的 lumina')
        await t.click((p) => p.getByRole('button', { name: 'Projects and settings' }), '再打开项目抽屉')
        await t.click((p) => p.getByRole('link', { name: /^Documents/ }), '点 Documents')
        await t.back('后退')
        await t.back('再后退')
      }
    },
  },
]
