// The page's commands and the server's handlers agree (refactor 3): the same ops, and no command field the server's
// handler never reads. SERVER_READS is the server's own list (tools/api_samples.py reads it from its handlers;
// tests/test_api_contract.py fails when the file is stale).

import { SERVER_READS } from './samples.gen'
import { OPS, type Command, type CommandOf, type Op } from '../model/commands'

type ServerOp = keyof typeof SERVER_READS
type Reads<K extends ServerOp> = (typeof SERVER_READS)[K][number]
type Fields<C> = C extends unknown ? keyof C : never
/** A field a command of this op has that its handler never reads ('op' is its name). */
type Unread<K extends Op> = K extends ServerOp ? Exclude<Fields<CommandOf<K>>, 'op' | Reads<K>> : never
type Problems =
  | { [K in Op]: [Unread<K>] extends [never] ? never : [K, 'is sent with', Unread<K>] }[Op]
  | (Exclude<Op, ServerOp> extends never ? never : ['the server has no handler for', Exclude<Op, ServerOp>])
  | (Exclude<ServerOp, Op> extends never ? never : ['the page has no command for', Exclude<ServerOp, Op>])

// the type check fails here, naming each problem, when the page's commands and the server's handlers differ
const agree: [Problems] extends [never] ? true : Problems = true

describe("the page's commands and the server's handlers", () => {
  test('the same ops', () => {
    expect(agree).toBe(true)
    expect(Object.keys(OPS).sort()).toEqual(Object.keys(SERVER_READS).sort())
  })

  test('every command takes the input it came from', () => {
    for (const reads of Object.values(SERVER_READS)) expect(reads).toContain('src')
    const c: Command = { op: 'archive', refs: ['B1'], on: true, src: 'r1' }
    expect(c.src).toBe('r1')
  })
})
