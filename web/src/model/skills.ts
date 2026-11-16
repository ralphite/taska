// Skills (I821): shared documents named /name (Settings › Shared rules). Words that start with a skill's name apply
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

/** The skills to pick from while one is being typed (null: no menu). */
export function skillMenu(text: string, skills: readonly Skill[]): Skill[] | null {
  if (!typingSkill(text)) return null
  const typed = text.toLowerCase()
  const found = skills.filter((s) => s.name.toLowerCase().startsWith(typed))
  return found.length ? found : null
}

/** The words once a skill is picked: its name and a space, then what you say. */
export const pickedSkill = (s: Skill) => `${s.name} `
