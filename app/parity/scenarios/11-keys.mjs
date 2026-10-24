// The keyboard (desktop): moving in the list, opening, the shortcuts list, the palette, going to Settings.
export default [
  {
    id: 'keys',
    title: '键盘：J/K、Enter、?、⌘K、G S',
    variants: ['desk-light', 'desk-dark'],
    async run(t) {
      await t.goto('/p/taska/')
      for (const k of ['j', 'j', 'k']) await t.key(k)
      await t.key('Enter', '按 Enter 打开')
      await t.key('Escape')
      await t.key('?', '按 ? 看快捷键')
      await t.key('Escape')
      await t.key('Meta+k', '按 ⌘K')
      await t.type('B533', '在面板里打 B533')
      await t.key('Enter', '按 Enter 去 B533')
      await t.key('g')
      await t.key('s', '按 G S 去设置')
      await t.key('Escape')
      await t.key('c', '按 C 新输入')
    },
  },
]
