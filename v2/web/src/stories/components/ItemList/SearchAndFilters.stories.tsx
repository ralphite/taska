// T512, B515: Item list > Search and filters: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as List from '../parts/List'

const meta: Meta = { title: 'Components/Item list/Search and filters' }
export default meta

export const Search: StoryObj = { ...List.Search, name: 'Search' }
export const SearchNothingFound: StoryObj = { ...List.SearchNothingFound, name: 'Nothing found' }
export const Filtered: StoryObj = { ...List.Filtered, name: 'Filtered: bugs, P0' }
