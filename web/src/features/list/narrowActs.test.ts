import { expect, test } from 'vitest'
import { NARROW_HIDE, NARROW_PILL } from './ListRows'

// F764 (Yadong r1284): on the desktop, a list narrower than about 90% of its width by default (360px; 420px wide,
// 460px huge: pages/ProjectPageContainer) shows an action's pill (Answer, Accept ...) as its icon only.
test('F764: the actions turn to icons under 90% of the list width by default', () => {
  const at = (cls: string) => [...cls.matchAll(/(?:(wide|huge):)?@max-\[(\d+)px\]\/list:hidden/g)].map((m) => [m[1] ?? 'lg', Number(m[2])])
  expect(at(NARROW_HIDE)).toEqual([['lg', 324], ['wide', 378], ['huge', 414]])
  for (const [, w] of at(NARROW_HIDE)) expect(NARROW_PILL).toContain(`@max-[${w}px]/list:w-8`)
})
