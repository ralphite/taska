// The page's types of the server's answers against the real answers (refactor 3). api/samples.gen.ts holds one real
// answer per call (tools/api_samples.py records them on a fresh Taska) and `satisfies` the types, which catches a field
// the server sends that a type lacks, and a required one it leaves out. This catches the other way: a field a type
// has (optional ones too) that no answer shows, so a field the server stopped sending, or never sent, is found.
// The few that a fresh Taska cannot show are listed below, each with why.
//
//   node scripts/check-api.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API = path.join(web, 'src/api/taska.ts')
const SAMPLES = path.join(web, 'src/api/samples.gen.ts')

/** Fields no answer of a fresh Taska shows, by their path (a path ending in `*` covers all under it). */
const VOICE = "the page's model puts a voice note's words there (B682); never sent"
const TYPED = "the page's model keeps the typed words there when it adds a voice note's words; never sent"
const UNSEEN = {
  'activity[].undo': 'only a change that undid another (FieldsSet undo_of); the sample makes none',
  'activity[].into': 'only a merge or unmerge; the sample makes none',
  'activity[].ids': 'only inputs marked handled together (InputsAcked); the sample makes none',
  'activity[].count': 'only voice notes split, blocks asked or notes kept; the sample makes none',
  'activity[].f': 'only a file taken off an input or comment (FileTakenOff); the sample makes none',
  'activity[].retry': 'only an input sent again; the sample makes none',
  'view.items[].thread[].files[].voice': VOICE,
  'view.items[].thread[].files[].size': "an agent's file is kept without its size (commands/items.py _message_files)",
  'view.items[].thread[].typed': TYPED,
  'view.items[].wait.files[].voice': VOICE,
  'view.items[].wait.files[].size': "an agent's file is kept without its size",
  'view.inputs[].files[].voice': VOICE,
  'view.inputs[].typed': TYPED,
  'view.inputs[].org.again': 'only an organizer failure kept from before it asked again by itself (T424); now it asks again instead',
  'view.inputs[].moved': 'a moved input shows in the project it went to, not here',
  'view.docs[].blocks[].comments[].files[].voice': VOICE,
  'view.docs[].blocks[].comments[].typed': TYPED,
  'view.docs[].blocks[].comments[].edited': 'only a comment you edited',
  'view.docs[].whole[].files[].voice': VOICE,
  'view.docs[].whole[].typed': TYPED,
  'view.docs[].whole[].edited': 'only a comment you edited',
  'view.docs[].detached[]*': 'only comments whose paragraph left the document',
  'view.docs[].proposals[]*': 'a proposal says only what its state has (decided, note, the text it would make)',
  'view.docs[].history[]*': 'a version says only what it was (restored, approved)',
  'view.voices[].early': 'only while a note is worked out',
  'view.voices[].err': 'only a note whose words failed',
  'view.voices[].fixed': 'only words you changed',
  'view.removed*': 'only an answer since a cursor, after something went',
  'view.project.agents[].blocked*': 'only an agent session that waits on you (T711)',
  'view.project.deletedInputs[].kept*': 'only an input whose items were made from others too',
  'view.project.deleted[].d': 'only a deleted document',
  'view.project.deleted[].on': 'only a deleted document',
  'changes*': "the sample is the answer of a wait that saw nothing; the rest is view's",
  'commands.changes*': "view's, after one change",
  'upload.voice': VOICE,
  'words.more': 'only while a note is worked out',
  'words.doubts[]*': 'what may be misheard says only what it has',
  'words.steps[].error': 'only a step that failed',
  'moveItem.with': 'only an item with subitems',
  'projects[].agents[]*': 'only a project an agent called',
  'projects[].pos': 'only a project you put in order',
  'find*': 'what is found depends on the words (model/find.test.ts)',
  'devDashboard*': 'a fresh Taska has no log to count',
  'login.error': 'only a key that is not right',
}

const config = ts.getParsedCommandLineOfConfigFile(path.join(web, 'tsconfig.app.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} })
const program = ts.createProgram([API, SAMPLES], config.options)
const checker = program.getTypeChecker()
const decl = program
  .getSourceFile(API)
  .statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === 'Answers')
const answers = checker.getTypeAtLocation(decl.name)
const text = fs.readFileSync(SAMPLES, 'utf8')
const samples = JSON.parse(/export const SAMPLES = (\{.*?\n\}) satisfies/s.exec(text)[1])

const unseen = []
const extra = []
const used = new Set()
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const NOTHING = ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Never | ts.TypeFlags.Void
const LEAF = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.Unknown | ts.TypeFlags.Any | ts.TypeFlags.EnumLike

function allowed(p) {
  for (const k of Object.keys(UNSEEN))
    if (k === p || (k.endsWith('*') && p.startsWith(k.slice(0, -1)))) {
      used.add(k)
      return true
    }
  return false
}

function walk(type, values, p, depth = 0) {
  if (depth > 12) return
  const members = (type.isUnion() ? type.types : [type]).filter((t) => !(t.flags & NOTHING))
  values = values.filter((v) => v !== null && v !== undefined)
  if (!members.length || members.every((t) => t.flags & LEAF)) return
  const arrays = members.filter((t) => checker.isArrayType(t))
  if (arrays.length) {
    const items = values.filter(Array.isArray).flat()
    for (const t of arrays) walk(checker.getTypeArguments(t)[0], items, p + '[]', depth + 1)
    return
  }
  const objects = members.filter((t) => !(t.flags & LEAF) && !checker.isTupleType(t))
  if (!objects.length) return
  const objs = values.filter(isObj)
  const props = new Map()
  let index = null
  for (const t of objects) {
    for (const s of checker.getPropertiesOfType(t)) if (!props.has(s.name)) props.set(s.name, [])
    for (const s of checker.getPropertiesOfType(t)) props.get(s.name).push(checker.getTypeOfSymbol(s))
    const info = checker.getIndexInfosOfType(t).find((i) => i.keyType.flags & ts.TypeFlags.String)
    if (info) index = info.type
  }
  if (index && !props.size) return walk(index, objs.flatMap((o) => Object.values(o)), p + '{}', depth + 1)
  for (const [name, types] of props) {
    const q = p ? `${p}.${name}` : name
    const vals = objs.filter((o) => name in o).map((o) => o[name])
    const never = types.every((t) => (t.isUnion() ? t.types : [t]).every((x) => x.flags & NOTHING))
    if (never) continue // `same?: never`: a field that tells one answer from another, never sent with this one
    if (!vals.length) {
      if (!allowed(q)) unseen.push(q)
      continue
    }
    for (const t of types) walk(t, vals, q, depth + 1)
  }
  if (!index) for (const o of objs) for (const k of Object.keys(o)) if (!props.has(k)) extra.push(`${p}.${k}`)
}

walk(answers, [samples], '')
const stale = Object.keys(UNSEEN).filter((k) => !used.has(k))
const problems = [
  ...[...new Set(unseen)].map((q) => `${q}: the page's type has it, no answer of the server shows it (tools/api_samples.py records the answers)`),
  ...[...new Set(extra)].map((q) => `${q}: the server sends it, the page's type does not have it`),
  ...stale.map((k) => `${k}: listed as unseen in scripts/check-api.mjs, but an answer shows it now: take it off the list`),
]
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`check-api: ${Object.keys(samples).length} answers agree with the page's types`)
