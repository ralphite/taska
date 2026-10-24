// What an agent writes shows on the open page by itself, with no reload: a new item, a message, a question.
export default [
  {
    id: 'agent-live',
    title: 'agent 写入后实时出现',
    async run(t) {
      await t.goto('/p/taska/')
      await t.agent('GET', '/p/taska/next?by=claude-code')
      await t.agent('POST', '/p/taska/do?by=claude-code', 'new bug P1 now Parity: a new item from an agent\n  It shows on the open page by itself.\n')
      await t.waitText('Parity: a new item from an agent', '等新事项出现在列表里')
      await t.goto('/p/taska/I447')
      await t.agent('POST', '/p/taska/do?by=codex', 'I447 say Parity: a message from an agent, shown live\n')
      await t.waitText('Parity: a message from an agent', '等消息出现在 I447 里')
      await t.agent('POST', '/p/taska/do?by=codex', 'I447 ask Parity: which one?\n  - ( ) first\n  - ( ) second\n')
      await t.waitText('Parity: which one?', '等问题出现')
      await t.agent('GET', '/p/taska/I447')
      await t.agent('GET', '/p/taska/next?by=codex')
    },
  },
]
