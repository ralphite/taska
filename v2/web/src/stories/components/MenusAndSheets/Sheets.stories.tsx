// T512, B515: Menus and sheets > Sheets: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Sheets from '../parts/Sheets'

const meta: Meta = { title: 'Components/Menus and sheets/Sheets' }
export default meta

export const Filters: StoryObj = { ...Sheets.Filters, name: 'Filters' }
export const Keys: StoryObj = { ...Sheets.Keys, name: 'Keyboard shortcuts' }
export const CommandPalette: StoryObj = { ...Sheets.CommandPalette, name: 'Command palette' }
export const Peek: StoryObj = { ...Sheets.Peek, name: 'Quick look' }
export const PeekGoingThrough: StoryObj = { ...Sheets.PeekGoingThrough, name: 'Going through on the phone' }
export const InputHistory: StoryObj = { ...Sheets.InputHistory, name: 'Input history' }
export const Sources: StoryObj = { ...Sheets.Sources, name: 'Where an item came from' }
export const AsSaid: StoryObj = { ...Sheets.AsSaid, name: 'Words as said' }
export const NotSaved: StoryObj = { ...Sheets.NotSaved, name: 'Not saved' }
export const SignIn: StoryObj = { ...Sheets.SignIn, name: 'Sign in' }
