// Every component the page draws is drawn by a story (T591): each exported component under ui/ and features/ must
// be reached from some *.stories.tsx, directly or through what the story renders. Found by reading the source, not
// by running it:
//
// - The graph's nodes are the top-level declarations of src/ (functions, consts, classes); a node points at every
//   top-level declaration its code names as a value (a JSX tag, a component passed as a prop, a fixture called),
//   followed through imports and re-exports. Types are not followed.
// - A story file names what it renders; everything reached from a story file is covered.
// - A container (named *Container, in a *Container.tsx file, or in app/) only connects stores and passes props:
//   it is covered when a story reaches it, or when it renders at least one component and every component it renders
//   is covered (by a story, or as a container by this same rule).
// - The rest are listed in web/.storybook/no-story.txt, one line each: `path#Name: why it needs no story`. A line
//   whose component is gone or now has a story is a break too.
//
// Each break says what to do: add a story, delete a component nothing renders, or list it with a reason.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import ts from 'typescript'

function files(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...files(p))
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

const isComponentName = (name) => /^[A-Z]/.test(name)
const hasJsx = (node) => {
  let found = false
  const walk = (n) => {
    if (found) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true
    else ts.forEachChild(n, walk)
  }
  walk(node)
  return found
}
/** A const's value is a component when it is a function (or memo/forwardRef of one) that returns JSX. */
const isFunctionValue = (e) =>
  !!e && (ts.isArrowFunction(e) || ts.isFunctionExpression(e) || (ts.isCallExpression(e) && e.arguments.some(isFunctionValue)))

/** One file read: its top-level declarations, what it imports and what it exports. */
function readFile(path) {
  const text = readFileSync(path, 'utf8')
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const decls = new Map() // name -> { node, component }
  const imports = new Map() // local name -> { spec, name } (name '*' for a namespace)
  const exports = new Map() // exported name -> local name
  const reexports = [] // { spec, from, as } (from '*' for export *)
  const exported = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  const isDefault = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const spec = st.moduleSpecifier.text
      const c = st.importClause
      if (!c || c.isTypeOnly) continue
      if (c.name) imports.set(c.name.text, { spec, name: 'default' })
      const b = c.namedBindings
      if (b && ts.isNamespaceImport(b)) imports.set(b.name.text, { spec, name: '*' })
      if (b && ts.isNamedImports(b))
        for (const el of b.elements) if (!el.isTypeOnly) imports.set(el.name.text, { spec, name: (el.propertyName ?? el.name).text })
    } else if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) {
      const name = st.name?.text ?? 'default'
      decls.set(name, { node: st, component: isComponentName(name) && hasJsx(st) })
      if (exported(st)) exports.set(isDefault(st) ? 'default' : name, name)
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue
        const name = d.name.text
        decls.set(name, { node: d, component: isComponentName(name) && isFunctionValue(d.initializer) && hasJsx(d.initializer) })
        if (exported(st)) exports.set(name, name)
      }
    } else if (ts.isExportDeclaration(st) && !st.isTypeOnly) {
      const spec = st.moduleSpecifier?.text
      if (!st.exportClause) reexports.push({ spec, from: '*', as: '*' })
      else if (ts.isNamedExports(st.exportClause))
        for (const el of st.exportClause.elements) {
          const from = (el.propertyName ?? el.name).text
          if (spec) reexports.push({ spec, from, as: el.name.text })
          else exports.set(el.name.text, from)
        }
    } else if (ts.isExportAssignment(st)) {
      decls.set('default', { node: st, component: false })
      exports.set('default', 'default')
    }
  }
  return { path, sf, decls, imports, exports, reexports }
}

/** The names a piece of code uses as values (not types, not property names). */
function namesUsed(node) {
  const out = []
  const walk = (n) => {
    if (ts.isTypeNode(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isImportDeclaration(n)) return
    if (ts.isPropertyAccessExpression(n)) {
      // X.Part through a namespace import: X then Part; a.b otherwise only a
      if (ts.isIdentifier(n.expression)) out.push([n.expression.text, n.name.text])
      else walk(n.expression)
      return
    }
    if (ts.isIdentifier(n)) {
      const p = n.parent
      const nameOnly =
        (ts.isPropertyAssignment(p) && p.name === n) || (ts.isJsxAttribute(p) && p.name === n) ||
        ((ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p)) && p.name === n) ||
        (ts.isBindingElement(p) && p.propertyName === n) ||
        ((ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isClassDeclaration(p)) && p.name === n)
      if (!nameOnly) out.push([n.text])
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(node)
  return out
}

/** Reads src/ into a graph of declarations and answers which components no story covers. */
export function storyCoverage(src, allowText) {
  const rel = (p) => relative(src, p).split(sep).join('/')
  const mods = new Map(files(src).map((p) => [p, readFile(p)]))
  const resolveSpec = (from, spec) => {
    if (!spec?.startsWith('.')) return null
    const base = join(dirname(from), spec)
    for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')])
      if (mods.has(p)) return p
    return null
  }
  /** The declaration a module's export is: `${path}#${local}`, or null when it is not in src/. */
  const exportOf = (path, name, seen = new Set()) => {
    const m = mods.get(path)
    if (!m || seen.has(`${path}#${name}`)) return null
    seen.add(`${path}#${name}`)
    const local = m.exports.get(name)
    if (local !== undefined) return lookup(m, local, seen)
    for (const r of m.reexports) {
      const to = resolveSpec(path, r.spec)
      if (!to) continue
      if (r.as === name) return exportOf(to, r.from, seen)
      if (r.from === '*') {
        const got = exportOf(to, name, seen)
        if (got) return got
      }
    }
    return null
  }
  /** What a name in a module stands for: its own declaration, or what it imports. */
  const lookup = (m, name, seen = new Set(), part) => {
    if (m.decls.has(name)) return `${m.path}#${name}`
    const imp = m.imports.get(name)
    if (!imp) return null
    const to = resolveSpec(m.path, imp.spec)
    if (!to) return null
    if (imp.name === '*') return part ? exportOf(to, part, seen) : null
    return exportOf(to, imp.name, seen)
  }
  const nodeOf = (id) => {
    const [path, name] = id.split('#')
    return mods.get(path).decls.get(name)
  }
  const edgesMemo = new Map()
  const edges = (m, node) => {
    const out = new Set()
    for (const [name, part] of namesUsed(node)) {
      const id = lookup(m, name, new Set(), part)
      if (id) out.add(id)
    }
    return out
  }
  const edgesOf = (id) => {
    if (!edgesMemo.has(id)) {
      const [path] = id.split('#')
      edgesMemo.set(id, edges(mods.get(path), nodeOf(id).node))
    }
    return edgesMemo.get(id)
  }
  const reach = (starts) => {
    const seen = new Set()
    const todo = [...starts]
    while (todo.length) {
      const id = todo.pop()
      if (seen.has(id)) continue
      seen.add(id)
      todo.push(...edgesOf(id))
    }
    return seen
  }

  const stories = [...mods.values()].filter((m) => m.path.endsWith('.stories.tsx'))
  const covered = reach(stories.flatMap((m) => [...edges(m, m.sf)]))
  const main = [...mods.values()].find((m) => rel(m.path) === 'main.tsx')
  const used = main ? reach(edges(main, main.sf)) : new Set()

  // the components in scope: exported, under ui/ or features/, not a story
  const scope = []
  for (const m of mods.values()) {
    const r = rel(m.path)
    if (!/^(ui|features)\//.test(r) || r.endsWith('.stories.tsx')) continue
    for (const [name, local] of m.exports) {
      const d = m.decls.get(local)
      if (d?.component) scope.push({ id: `${m.path}#${local}`, file: r, name: local })
    }
  }
  const isComponent = (id) => nodeOf(id)?.component
  const isContainer = (id) => /Container$/.test(id.split('#')[1]) || /Container\.tsx#/.test(id) || rel(id.split('#')[0]).startsWith('app/')
  const containerOk = new Map()
  const ok = (id, path = new Set()) => {
    if (covered.has(id)) return true
    if (!isContainer(id) || path.has(id)) return false
    if (!containerOk.has(id)) {
      path.add(id)
      const parts = [...edgesOf(id)].filter(isComponent)
      containerOk.set(id, parts.length > 0 && parts.every((p) => ok(p, path)))
      path.delete(id)
    }
    return containerOk.get(id)
  }

  const allow = new Map()
  const breaks = []
  for (const [i, raw] of (allowText ?? '').split('\n').entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(\S+)#(\w+):\s*(.*)$/.exec(line)
    if (!m || !m[3]) breaks.push(`no-story.txt line ${i + 1}: write it as "path#Name: why it needs no story" (${line.slice(0, 60)})`)
    else allow.set(`${m[1]}#${m[2]}`, i + 1)
  }
  const inScope = new Set(scope.map((c) => `${c.file}#${c.name}`))
  for (const c of scope) {
    const key = `${c.file}#${c.name}`
    if (ok(c.id)) {
      if (allow.has(key)) breaks.push(`no-story.txt line ${allow.get(key)}: ${key} has a story now (take the line out)`)
    } else if (!allow.has(key)) {
      const missing = isContainer(c.id) ? [...edgesOf(c.id)].filter((p) => isComponent(p) && !ok(p)).map((p) => `${rel(p.split('#')[0])}#${p.split('#')[1]}`) : []
      const via = missing.length ? ` (a container: it renders ${missing.join(', ')}, which no story draws)` : ''
      breaks.push(
        used.has(c.id)
          ? `${c.file}: ${c.name} is drawn by no story${via} (add a story under Components/… that renders it, with real fixtures, or a line "${key}: why" in web/.storybook/no-story.txt)`
          : `${c.file}: ${c.name} is drawn by no story${via} and nothing in the page renders it (delete it)`,
      )
    }
  }
  for (const [key, line] of allow) if (!inScope.has(key)) breaks.push(`no-story.txt line ${line}: ${key} is not a component any more (take the line out)`)
  return breaks
}

/** The allowlist kept next to Storybook's settings. */
export function readAllow(web) {
  const p = join(web, '.storybook', 'no-story.txt')
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}
