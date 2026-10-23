// T512, B515: Icons and marks > Search hit: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Basics from '../parts/Basics'

const meta: Meta = { title: 'Components/Icons and marks/Search hit' }
export default meta

export const SearchHit: StoryObj = { ...Basics.SearchHit, name: 'Searched words marked' }
