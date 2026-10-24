// The home page: every project, what needs Yadong, the search box.
export default [
  {
    id: 'home',
    title: '首页：项目列表',
    async run(t) {
      await t.goto('/')
      if (t.desk) {
        await t.hover('taska', '指着 taska 这一行')
        await t.click(p => p.getByPlaceholder('Search every project'), '点搜索框')
        await t.type('storybook', '搜 storybook')
        await t.key('Escape', '按 Esc')
      }
      await t.click('lumina', '打开 lumina')
    },
  },
]
