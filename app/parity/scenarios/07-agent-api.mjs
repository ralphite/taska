// The agent interface, word for word: what an agent reads, what it writes and the answers it gets, errors included.
// No page is needed, so this runs once (desktop light).
const READS = [
  '/p/taska/agent',
  '/p/taska/next',
  '/p/taska/next?by=claude-code&session=parity',
  '/p/taska/inbox',
  '/p/taska/items',
  '/p/taska/items?status=all&limit=60',
  '/p/taska/items?q=storybook&type=bug',
  '/p/taska/items?wait=1',
  '/p/taska/items?reply=1',
  '/p/taska/items?archived=1&limit=20',
  '/p/taska/F432',
  '/p/taska/f432',
  '/p/taska/432',
  '/p/taska/I447',
  '/p/taska/B9999',
  '/p/taska/D1',
  '/p/taska/D39',
  '/p/taska/log?n=30',
  '/p/taska/rules',
  '/p/taska/connect',
  '/p/taska/skill',
  '/p/home/next',
  '/p/home/items',
  '/p/lumina/agent',
  '/p/nosuchproject/next',
  '/next',
  '/agent',
]
const WRITES = [
  'new bug P2 now Parity: export ignores the filter\n  The body of the bug.\n',
  'new task later parent=F432 Parity: a subitem\n',
  '$ doing\n',
  'F432 progress Parity: progress words\n',
  'I447 say Parity: a message with **bold** and `code`\n',
  'I447 ask Parity: pick one\n  - ( ) yes\n  - ( ) no\n',
  'I447 withdraw Parity: not needed after all\n',
  'B533 P1 now\n',
  'B533 title Parity: a new title\n',
  'T468 done Parity: done report\n  Result: it works.\n',
  'F432 doc Parity plan\n  # Parity plan\n\n  First paragraph.\n\n  Second paragraph.\n',
  'nonsense words here\n',
  'B9999 say to nothing\n',
  'ack r1\n',
]
// More commands in one request each, as agents send them: $ refs, merges, docs, html pages, replies, files.
const WRITES_2 = [
  'new idea P3 later src=r1 Parity: an idea\n  with a body\n$ propose Parity: a plan for it\n$ decide Parity: decided\n',
  'new feature P1 now Parity: dup A\nnew feature P1 now Parity: dup B\n',
  'b533 say ref in lower case\n533 say ref as a number\n',
  'B533 block Parity: need a decision\n',
  'B533 say @worker Parity: to another session\n',
  'B533 next Parity: the next step\nB533 body Parity: a new body\n  second line\n',
  'F432 html Parity page\n  <h1>Parity</h1><p>A page.</p><script>document.body.dataset.x=1</script>\n',
  'T468 archive\nT468 unarchive\n',
  'B533 drop Parity: not needed\n',
  'B533 open\n',
  'I447 ask Parity: pick any\n  - [ ] one\n  - [ ] two\n',
  'R1 say a rule comment\n',
  'new rule Parity: a new rule\n',
]
export default [
  {
    id: 'agent-api',
    title: 'agent 接口：读和写，逐字一样',
    variants: ['desk-light'],
    async run(t) {
      for (const p of READS) await t.agent('GET', p)
      for (const w of WRITES) await t.agent('POST', '/p/taska/do?by=claude-code&session=parity', w, `agent /do ${w.split('\n')[0]}`)
      for (const w of WRITES_2) await t.agent('POST', '/p/taska/do?by=codex&session=parity2', w, `agent /do ${w.split('\n')[0]}`)
      const up = await t.agent('POST', '/p/taska/api/file?name=parity.txt', 'a file from an agent\n', 'agent 上传文件')
      const f = /f\d+[^\s"]*/.exec(up)?.[0]
      if (f) await t.agent('POST', '/p/taska/do?by=codex', `B533 say files=${f} Parity: with a file\n`, 'agent 发带文件的消息')
      for (const p of ['/p/taska/next?by=claude-code', '/p/taska/next?by=codex', '/p/taska/items?status=all&limit=40', '/p/taska/F432',
        '/p/taska/B533', '/p/taska/log?n=40', '/p/taska/I447', '/p/taska/rules', '/p/taska/inbox'])
        await t.agent('GET', p, null, `写完后 GET ${p}`)
      for (const d of ['D1', 'D39', 'D2'])
        await t.agent('POST', '/p/taska/do?by=claude-code', `${d} reply ¶1 Parity: a reply\n`, `agent 回复 ${d} ¶1`)
    },
  },
]
