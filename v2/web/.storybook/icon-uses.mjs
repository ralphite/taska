// T513: every icon the page uses, and where, read from the code itself. An icon name is a string the type checker
// expects to be an IconName (lib/icons.ts): <Icon n="x" />, an icon prop, a map of icons, a list of buttons with
// their icons. The type makes a name that is not an icon fail the build (tsc); this finds every use, so the
// Storybook gallery lists them all and nothing can be used without showing there.
import ts from 'typescript'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

export function iconUses() {
  const cfgPath = join(ROOT, 'tsconfig.app.json')
  const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, ROOT)
  const files = cfg.fileNames.filter((f) => /\/src\/(components|pages|lib)\//.test(f) && !/\.(test|stories)\./.test(f))
  const program = ts.createProgram(files, cfg.options)
  const checker = program.getTypeChecker()
  // the names, from the ICON map's own type
  const iconsFile = program.getSourceFile(join(ROOT, 'src/lib/icons.ts'))
  let decl
  iconsFile.forEachChild((n) => {
    if (ts.isVariableStatement(n))
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === 'ICON') decl = d
  })
  if (!decl) throw new Error('icon-uses: no ICON in src/lib/icons.ts')
  const icons = checker
    .getTypeAtLocation(decl.name)
    .getProperties()
    .map((x) => x.name)
  if (icons.length < 10) throw new Error('icon-uses: could not read the icon names')
  const names = new Set(icons)
  const isIconType = (t) => {
    if (!t) return false
    const parts = t.isUnion() ? t.types : [t]
    const lits = parts.filter((p) => p.isStringLiteral()).map((p) => p.value)
    // IconName (or a part of it): only icon names, and most of them
    return lits.length >= Math.min(20, names.size) && lits.every((v) => names.has(v))
  }
  const where = (node) => {
    for (let p = node.parent; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p)) && p.name) return p.name.text
      if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && /^[A-Z_]/.test(p.name.text)) return p.name.text
      if (ts.isPropertyAssignment(p) && p.parent && ts.isObjectLiteralExpression(p.parent)) {
        const v = p.parent.parent
        if (v && ts.isVariableDeclaration(v) && ts.isIdentifier(v.name) && /^[A-Z_]/.test(v.name.text))
          return v.name.text
      }
    }
    return ''
  }
  const uses = Object.fromEntries(icons.map((n) => [n, []]))
  const unknown = []
  for (const sf of program.getSourceFiles()) {
    if (!files.includes(sf.fileName)) continue
    const visit = (node) => {
      const isKey =
        node.parent &&
        (ts.isPropertyAssignment(node.parent) || ts.isPropertySignature(node.parent)) &&
        node.parent.name === node
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isKey) {
        if (isIconType(checker.getContextualType(node))) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart())
          const use = { file: relative(join(ROOT, 'src'), sf.fileName), in: where(node) || `line ${line + 1}` }
          const list = uses[node.text]
          if (!names.has(node.text)) unknown.push({ name: node.text, ...use, line: line + 1 })
          else if (!list.some((u) => u.file === use.file && u.in === use.in)) list.push(use) // once per part
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return { icons, uses, unknown }
}
