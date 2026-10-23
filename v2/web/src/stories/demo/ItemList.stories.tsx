// T457 (#6481): finding things in the item list: its views, search, filters, your own views. Each demo is its steps.
import type { Meta } from '@storybook/react-vite'
import { demo, only, openMenu, tap, write } from './demo'
import { W } from './words'

export default { title: 'Demo/Item list' } satisfies Meta

const filters = tap('Tap Filters', 'filters', 1)
const search = [tap('Tap search', 'search'), write('Type a word', W.search, 'searchField')]

export const SwitchViews = demo({
  steps: [
    tap('Needs you: what waits on you', 'needsYou'),
    tap('Queue: what agents do next, in order', 'queue'),
    tap('Later: put off for now', 'laterView'),
    tap('Finished: done or not doing', 'finished'),
    tap('All: everything', 'all'),
    tap('Active: back to what is going on', 'active'),
  ],
  done: 'One list, seen six ways',
})

export const LookInTheArchive = demo({
  steps: [
    tap('Tap Archive: finished items put away', 'archiveTab'),
    tap('Open one', 'B21'),
    only('phone', openMenu),
    tap('Tap Unarchive: it is back with the others', 'archive'),
  ],
  done: 'Out of the archive',
})

export const SearchItems = demo({
  steps: [...search, tap('Open what you were looking for', 'F1')],
  done: 'Found by its words; other projects show their hits below',
})

export const SearchWhatYouSaid = demo({
  steps: [...search, tap('Tap Show: what you said with that word', 'searchInputs')],
  done: 'Your own inputs with that word, newest first',
})

export const FilterByTypeAndPriority = demo({
  steps: [filters, tap('Only bugs', 'bugs'), tap('Only P0', 'p0'), tap('Fold the filters away', 'filters', 1)],
  done: 'The list shows only urgent bugs; the filter stays on its chip',
})

export const SortByNewest = demo({
  steps: [filters, tap('Tap Newest: the newest items first', 'newest')],
  done: 'Newest first',
})

export const SaveYourOwnView = demo({
  steps: [filters, tap('Only bugs', 'bugs'), write('Name it', 'Bugs', 'viewName'), tap('Tap Save', 'viewSave')],
  done: 'Your view sits with the others, in every project',
})

export const FoldSubitems = demo({
  steps: [tap('Tap the arrow: its subitems fold away', 'fold', 1), tap('Tap it again: they are back', 'fold', 1)],
  done: 'Subitems shown or folded, as you like',
})

export const PickSeveralAtOnce = demo({
  on: 'desktop',
  steps: [
    { ...tap('Cmd-click a row', 'T3'), hold: 'Meta' },
    { ...tap('Cmd-click another', 'T15'), hold: 'Meta' },
    tap('Tap Later: both go to Later', 'selLater'),
  ],
  done: 'Both changed in one go, with Undo',
})
