// What a row can carry: priority, a picture, a draft, new from an agent, searched words, long titles.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PICTURE } from '../../stories/fixtures'
import { one } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/What it shows' } satisfies Meta
type Story = StoryObj

export const P0: Story = { ...one({ it: { type: 'bug', pri: 'P0', title: 'Saving drops the last word' }, f: { code: 'B012' } }), name: 'P0' }
export const P3: Story = { ...one({ it: { pri: 'P3' } }), name: 'P3' }
export const NewFromAnAgent: Story = { ...one({ f: { unread: true, talk: 2 } }), name: 'New from an agent' }
export const WithADraft: Story = { ...one({ f: { draft: true } }), name: 'With a draft' }
export const WithAPicture: Story = { ...one({ f: { image: { f: 'f1-shot.png', src: PICTURE } } }), name: 'With a picture' }
export const SearchedWords: Story = { ...one({ l: { words: ['filter', 'csv'] }, f: { hitLine: '…the CSV keeps every row' } }), name: 'Searched words marked, one found in its talk' }
export const LongEnglishTitle: Story = { ...one({ it: { title: "Search finds the words in an item's talk and its documents too, and says where it found them when that is not the title" } }), name: 'A long English title' }
export const LongChineseTitle: Story = { ...one({ it: { title: '\u81ea\u884c\u5168\u9762\u6d4b\u8bd5\u5e76\u4fee\u590d\u7f51\u9875\u6587\u6863\u7684\u6240\u6709 bug\uff0c\u5305\u62ec\u8bc4\u8bba\u3001\u9009\u533a\u3001\u622a\u56fe\u548c\u5bfc\u51fa\uff0c\u5728\u624b\u673a\u548c\u7535\u8111\u4e0a\u90fd\u8981\u6d4b' } }), name: 'A long Chinese title' }
