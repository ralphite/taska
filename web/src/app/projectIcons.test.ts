import { describe, expect, test } from 'vitest'
import type { ProjectModel } from '../model/project'
import type { ProjectRow } from '../model/types'
import { sideProjects } from './sideProjects'

// F743: the projects as the page lists them carry each one's picture (an agent set it), this one's from its own data.
describe("the projects' pictures", () => {
  test('the sidebar lists each project with its picture, as listed', () => {
    const rows: ProjectRow[] = [
      { name: 'taska', title: 'Taska', icon: 'f12-logo.png', open: 3, needs: 0 },
      { name: 'nota', title: 'Nota', icon: '', open: 1, needs: 0 },
    ]
    const { list } = sideProjects(rows, null, 'nota')
    expect(list?.map((p) => [p.slug, p.icon])).toEqual([
      ['nota', undefined],
      ['taska', '/p/taska/f/f12-logo.png'],
    ])
  })

  test("this project's own data says its picture, before the list does", () => {
    const rows: ProjectRow[] = [{ name: 'taska', title: 'Taska', open: 3, needs: 0 }]
    // the little of a project's model the list reads
    const m = { facts: { title: 'Taska', icon: 'f20-new.png' }, items: [], inputs: [], docs: [], at: 0 } as unknown as ProjectModel
    const { list, icons } = sideProjects(rows, m, 'taska')
    expect(list?.[0].icon).toBe('/p/taska/f/f20-new.png')
    expect(icons.get('taska')).toBe('/p/taska/f/f20-new.png')
  })
})
