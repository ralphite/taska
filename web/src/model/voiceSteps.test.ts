import { describe, expect, it } from 'vitest'
import { stepsInOrder, wordDiff } from './voiceSteps'

describe('wordDiff', () => {
  it('keeps the common words and marks the changed ones, CJK by character', () => {
    expect(wordDiff('我不大明白', '我不太明白')).toEqual([
      { mark: '', text: '我不' },
      { mark: 'removed', text: '大' },
      { mark: 'added', text: '太' },
      { mark: '', text: '明白' },
    ])
  })
  it('a Latin word next to CJK is its own word', () => {
    expect(wordDiff('通过review代码', '通过 review 代码').filter((p) => p.mark)).toEqual([
      { mark: 'added', text: ' ' },
      { mark: 'added', text: ' ' },
    ])
  })
  it('compares Latin words whole', () => {
    expect(wordDiff('write to task', 'write to Taska')).toEqual([
      { mark: '', text: 'write to ' },
      { mark: 'removed', text: 'task' },
      { mark: 'added', text: 'Taska' },
    ])
  })
})

describe('stepsInOrder (B727)', () => {
  const steps = [
    { step: 'pro', model: 'strong', error: 'no answer within 30 s', secs: 30 },
    { step: 'asr', model: 'speech', text: '回复在最上面', secs: 2 },
    { step: 'pro_2', model: 'strong', text: '回复在最下面', secs: 5, chosen: true },
    { step: 'tidy', model: 'tidy', text: '回复在最下面。', secs: 1 },
  ]
  it('orders them as their words arrived: first words, the failed try, its retry, the tidied words last', () => {
    expect(stepsInOrder(steps).map((s) => s.step.step)).toEqual(['asr', 'pro', 'pro_2', 'tidy'])
  })
  it('shows the first words in full and every later step only as what it changed, no words twice', () => {
    const [first, failed, retry, tidy] = stepsInOrder(steps)
    expect(first).toMatchObject({ full: true, diff: null })
    expect(failed).toMatchObject({ full: false, diff: null })
    expect(retry.diff?.filter((p) => p.mark)).toEqual([
      { mark: 'removed', text: '上' },
      { mark: 'added', text: '下' },
    ])
    expect(tidy.diff?.filter((p) => p.mark)).toEqual([{ mark: 'added', text: '。' }])
  })
  it('a step with the same words as the one before shows no diff', () => {
    const same = stepsInOrder([
      { step: 'asr', model: 's', text: 'Keep the filter', secs: 2 },
      { step: 'pro', model: 'p', text: 'Keep the filter', secs: 6, chosen: true },
    ])
    expect(same[1]).toMatchObject({ full: false, diff: null })
  })
})
