// B665 (D136 C343): a tooltip shows and hides at once, where it belongs: no fly-in, no fade, no movement.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

test('the tooltip has no animation', () => {
  const code = readFileSync(join(__dirname, 'Tooltip.tsx'), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n')
  expect(code.match(/\banimate-\S+|\btransition\S*|@keyframes|\bduration-\d+|\btranslate-[xy]-\S+/g) ?? []).toEqual([])
})
