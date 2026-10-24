// The talk on an item: answering a question with a choice, replying in words, and what the agent then reads.
export default [
  {
    id: 'talk',
    title: '对话：点选项回答问题，写回复',
    async run(t) {
      await t.goto('/p/taska/I447')
      await t.reveal((p) => p.getByRole('button', { name: /^保持现在/ }), '滚到问题的选项')
      await t.click((p) => p.getByRole('button', { name: /^保持现在/ }), '选第一个选项')
      await t.click((p) => p.getByRole('button', { name: /^Send answer/ }), '点 Send answer')
      await t.agent('GET', '/p/taska/I447')
      await t.click((p) => p.getByRole('textbox', { name: 'Input' }), '点回复框')
      await t.type('Parity: a reply from Yadong', '写回复')
      if (t.desk) await t.key('Meta+Enter', '按 ⌘↵ 发出')
      else await t.click((p) => p.getByRole('button', { name: /^Send/ }), '点发送')
      await t.agent('GET', '/p/taska/next?by=claude-code')
      await t.agent('GET', '/p/taska/I447')
    },
  },
  {
    id: 'talk-review',
    title: '对话：验收一个做完的事项',
    async run(t) {
      await t.goto('/p/taska/?status=review')
      await t.goto('/p/taska/F479')
      await t.click((p) => p.getByRole('textbox', { name: 'Input' }), '点回复框')
      await t.type('Parity: looks good', '写一句')
      await t.key(t.desk ? 'Escape' : 'Tab', '离开输入框')
      await t.reload('刷新（草稿还在）')
    },
  },
]
