// T512, B515: Menus and sheets > Sheets: the keys' sheets (desktop), the phone's filters and cards, and the sheets an
// item, what you said or a change not saved opens; the parts module opens each the page's way
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Sheets from '../parts/Sheets'

const meta: Meta = { title: 'Components/Menus and sheets/Sheets' }
export default meta

const desktop = { platform: 'desktop' }
const phone = { platform: 'phone' }
export const CommandPalette: StoryObj = {
  ...Sheets.CommandPalette,
  name: 'Command palette',
  parameters: { ...Sheets.CommandPalette.parameters, ...desktop },
}
export const CommandPaletteOnAnItem: StoryObj = {
  ...Sheets.CommandPaletteOnAnItem,
  name: 'Command palette on an item',
  parameters: { ...Sheets.CommandPaletteOnAnItem.parameters, ...desktop },
}
export const CommandPaletteFinding: StoryObj = {
  ...Sheets.CommandPaletteFinding,
  name: 'Command palette: finding items',
  parameters: { ...Sheets.CommandPaletteFinding.parameters, ...desktop },
}
export const CommandPaletteNothingMatches: StoryObj = {
  ...Sheets.CommandPaletteNothingMatches,
  name: 'Command palette: nothing matches',
  parameters: { ...Sheets.CommandPaletteNothingMatches.parameters, ...desktop },
}
export const SwitchProject: StoryObj = {
  ...Sheets.SwitchProject,
  name: 'Switch project',
  parameters: { ...Sheets.SwitchProject.parameters, ...desktop },
}
export const SwitchProjectNothingMatches: StoryObj = {
  ...Sheets.SwitchProjectNothingMatches,
  name: 'Switch project: nothing matches',
  parameters: { ...Sheets.SwitchProjectNothingMatches.parameters, ...desktop },
}
export const Keys: StoryObj = {
  ...Sheets.Keys,
  name: 'Keyboard shortcuts',
  parameters: { ...Sheets.Keys.parameters, ...desktop },
}
export const Filters: StoryObj = {
  ...Sheets.Filters,
  name: 'Filters',
  parameters: { ...Sheets.Filters.parameters, ...phone },
}
export const Peek: StoryObj = {
  ...Sheets.Peek,
  name: "An item's card",
  parameters: { ...Sheets.Peek.parameters, ...phone },
}
export const PeekGoingThrough: StoryObj = {
  ...Sheets.PeekGoingThrough,
  name: 'Going through what needs you',
  parameters: { ...Sheets.PeekGoingThrough.parameters, ...phone },
}
export const Sources: StoryObj = { ...Sheets.Sources, name: 'What an item came from' }
export const AsSaid: StoryObj = { ...Sheets.AsSaid, name: 'Original words' }
export const AsSaidNothingTidied: StoryObj = { ...Sheets.AsSaidNothingTidied, name: 'Original words: nothing tidied' }
export const InputHistory: StoryObj = { ...Sheets.InputHistory, name: 'What you said: history' }
export const NotSaved: StoryObj = { ...Sheets.NotSaved, name: 'Not saved' }
export const NotSavedOne: StoryObj = { ...Sheets.NotSavedOne, name: 'Not saved: one change' }
export const SignIn: StoryObj = { ...Sheets.SignIn, name: 'Sign in' }
