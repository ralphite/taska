// A voice note's words with two misheard places: one the models disagree on, one the main model was unsure of.

import type { HeardFile } from '../model/doubts'

export const HEARD_TEXT = 'Move the filter to the side bar and keep the old colours (?) for now.'
export const HEARD: HeardFile[] = [
  {
    key: 'v1',
    trAdded: HEARD_TEXT,
    doubts: [
      { was: 'side bar', alt: 'sidebar', why: 'two models', show: ['side bar', 'sidebar'] },
      { was: 'colours (?)', alt: '', why: 'unsure' },
    ],
  },
]
