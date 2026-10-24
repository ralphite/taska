// Speed, measured one side at a time: opening Taska, a big project, a long item, the biggest views.
const blank = (s) => s.page.goto('about:blank')
const open = (path) => (s) => s.page.goto(s.base + path, { waitUntil: 'commit' })
export default [
  {
    id: 'speed',
    title: '速度：打开、切换、长列表、长对话',
    variants: ['desk-light', 'phone-light'],
    async run(t) {
      await t.timed('打开首页', open('/'), { before: blank })
      await t.timed('打开 taska 项目', open('/p/taska/'), { before: blank })
      await t.timed('打开长对话 I447', open('/p/taska/I447'), { before: blank })
      await t.timed('打开 Archive（281 个）', open('/p/taska/archive'), { before: blank })
      await t.goto('/p/taska/')
      const all = await t.point((p) => p.getByRole('button', { name: /^All \d/ }))
      const active = await t.point((p) => p.getByRole('button', { name: /^Active \d/ }))
      const tap = (pt) => (s) => (t.phone ? s.page.touchscreen.tap(pt.x, pt.y) : s.page.mouse.click(pt.x, pt.y))
      await t.timed('切到 All（197 个）', tap(all), { before: tap(active) })
      if (t.desk) {
        const lumina = await t.point((p) => p.getByRole('link', { name: /^lumina / }))
        const taska = await t.point((p) => p.getByRole('link', { name: /^taska / }))
        await t.timed('侧栏切到 lumina', tap(lumina), { before: tap(taska) })
      }
    },
  },
]
