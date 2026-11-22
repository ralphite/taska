// Skills (T821): shared documents named /name (Settings › Shared rules). Words that start with a skill's name apply
// it: every agent gets the skill's text with them (the server, domain/skills.py). Typing "/" at the start of the box
// lists them, to pick one. Pure.

import type { SharedRule } from './types'

export interface Skill {
  name: string
  /** what it is for: its first line of words */
  what: string
}

export const isSkill = (name: string) => name.trim().startsWith('/') && name.trim().length > 1

const summary = (md: string) =>
  md
    .split('\n')
    .map((l) => l.trim().replace(/^#+\s*/, ''))
    .find(Boolean) ?? ''

/** The skills among the shared rules, by name. */
export function skillsOf(shared: readonly SharedRule[] | null | undefined): Skill[] {
  return (shared || [])
    .filter((r) => isSkill(r.name))
    .map((r) => ({ name: r.name, what: summary(r.md) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The box's words are a skill's name being typed: a "/" and letters, at the very start, nothing after. */
export const typingSkill = (text: string) => /^\/[\w-]*$/.test(text)

/** Where the letters typed fall in a skill's name, in order, any case (null: they do not all fit). Like Codex's
 * skill list: "/pl" and "/pn" both find /plan. */
export function fits(name: string, text: string): number[] | null {
  const n = name.toLowerCase()
  const at: number[] = []
  let from = 1 // after the "/"
  for (const c of text.slice(1).toLowerCase()) {
    const i = n.indexOf(c, from)
    if (i < 0) return null
    at.push(i)
    from = i + 1
  }
  return at
}

/** The skills to pick from while one is being typed (null: no menu): those the letters fit, the ones they start
 * first, then where they fit earliest. */
export function skillMenu(text: string, skills: readonly Skill[]): Skill[] | null {
  if (!typingSkill(text)) return null
  const found = skills
    .map((s) => ({ s, at: fits(s.name, text) }))
    .filter((x): x is { s: Skill; at: number[] } => x.at !== null)
    .map(({ s, at }) => ({ s, rank: at.length ? at.reduce((a, i, k) => a + i - k - 1, 0) : 0 }))
    .sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name))
  return found.length ? found.map((x) => x.s) : null
}

/** The words once a skill is picked: its name and a space, then what you say. */
export const pickedSkill = (s: Skill) => `${s.name} `
