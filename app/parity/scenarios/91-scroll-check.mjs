// Opt-in: items opened one after another by their address in one browser, as the sweep does, to check where the
// list scrolls (P19). Run old vs old too: the old page's own scroll is not steady on some items.
const codes = (text) => [...text.matchAll(/^([FBITR]\d+) /gm)].map((m) => m[1])
export default [
  {
    id: 'scroll-check',
    title: '用地址依次打开事项：列表滚到哪',
    optIn: true,
    variants: ['desk-light'],
    async run(t) {
      const list = await t.agent('GET', '/p/macstudio/items?status=all&archived=all&limit=5000', null, 'macstudio 的全部事项')
      await t.goto('/p/macstudio/')
      for (const c of codes(list)) await t.goto(`/p/macstudio/${c}`, `macstudio ${c}`)
      await t.goto('/p/taska/')
      for (const c of ['F208', 'F210', 'F220', 'F221', 'B222', 'B223', 'B247', 'F294', 'F295', 'T308']) await t.goto(`/p/taska/${c}`, `taska ${c}`)
    },
  },
]
