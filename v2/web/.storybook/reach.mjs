// T545: every component in Storybook (prototypes aside) must be one the page really draws. This follows the page's
// code from its entry (src/main.tsx): every top-level function, component, constant it names, and everything those
// name in turn. A component the page never reaches this way is drawn by nothing but its story.
import ts from 'typescript'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

export function reach() {
  const cfg = ts.parseJsonConfigFileContent(
    ts.readConfigFile(join(ROOT, 'tsconfig.app.json'), ts.sys.readFile).config,
    ts.sys,
    ROOT,
  )
  const files = cfg.fileNames.filter(
    (f) => /\/src\//.test(f) && !/\/src\/(stories|prototypes|test)\//.test(f) && !/\.(test|stories)\./.test(f),
  )
  const program = ts.createProgram(files, cfg.options)
  const checker = program.getTypeChecker()
  // each top-level declaration, by its symbol: what it names
  const decls = new Map() // symbol -> { name, file, refs: Set<symbol> }
  const top = (sf) => {
    const out = []
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name) out.push([st.name, st])
      else if (ts.isVariableStatement(st))
        for (const d of st.declarationList.declarations)
          if (ts.isIdentifier(d.name)) out.push([d.name, d])
          else if (ts.isClassDeclaration(st) && st.name) out.push([st.name, st])
    }
    return out
  }
  const real = (sym) => (sym && sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym)
  for (const sf of program.getSourceFiles()) {
    if (!files.includes(sf.fileName)) continue
    for (const [id, node] of top(sf)) {
      const sym = checker.getSymbolAtLocation(id)
      if (!sym) continue
      const refs = new Set()
      const visit = (n) => {
        if (ts.isIdentifier(n) && n !== id) {
          const s = real(checker.getSymbolAtLocation(n))
          if (s && s !== sym) refs.add(s)
        }
        ts.forEachChild(n, visit)
      }
      ts.forEachChild(node, visit)
      decls.set(sym, { name: id.text, file: relative(join(ROOT, 'src'), sf.fileName), refs })
    }
  }
  // the entry's own statements name the roots (main.tsx renders <App />)
  const entry = program.getSourceFile(join(ROOT, 'src/main.tsx'))
  const seen = new Set(),
    todo = []
  const visitEntry = (n) => {
    if (ts.isIdentifier(n)) {
      const s = real(checker.getSymbolAtLocation(n))
      if (s && decls.has(s)) todo.push(s)
    }
    ts.forEachChild(n, visitEntry)
  }
  visitEntry(entry)
  while (todo.length) {
    const s = todo.pop()
    if (seen.has(s)) continue
    seen.add(s)
    for (const r of decls.get(s)?.refs || []) if (decls.has(r) && !seen.has(r)) todo.push(r)
  }
  // 'components/Detail.tsx NoSelection': each one the page reaches
  return new Set([...seen].map((s) => `${decls.get(s).file} ${decls.get(s).name}`))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const got = reach()
  console.log(
    [...got]
      .filter((k) => /^(components|pages|layouts)\/\S+ [A-Z]\w*[a-z]/.test(k))
      .sort()
      .join('\n'),
  )
}
