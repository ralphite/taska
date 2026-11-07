import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { FileRef } from '../model/types'
import { FileChips, Thumbs, VoiceBubble, type FileEvents, type PlayState } from './Files'

// B712 (r1165): a voice note is one chip in every place: play, its length, then the mark for its original words; your
// blue bubble holds the same chip, never a pill of its own with "0:00 / 0:21".
const note: FileRef = { f: 'f1-voice_0-21.webm', name: 'voice_0-21.webm', mime: 'audio/webm' }
const still = (): PlayState => ({ playing: false, t: null })
const on: FileEvents = { play: () => {}, words: () => {}, view: () => {} }
const url = (f: string) => f

const chipOf = () => {
  const play = screen.getByRole('button', { name: 'Play the voice note, 0:21' })
  const chip = play.parentElement as HTMLElement
  return { play, chip }
}

describe('a voice note', () => {
  const places = {
    'a message': () => <Thumbs files={[note]} url={url} play={still} tidy on={on} />,
    'the lists of inputs': () => <FileChips files={[note]} url={url} play={still} tidy on={on} />,
    'your bubble, under your words': () => <VoiceBubble cls="" files={[note]} url={url} play={still} tidy top={<p>About the export</p>} on={on} />,
    'your bubble, alone': () => <VoiceBubble cls="" files={[note]} url={url} play={still} tidy on={on} />,
  }
  for (const [where, draw] of Object.entries(places))
    test(`in ${where}: play, its length, its original words, in that order`, () => {
      render(draw())
      const { play, chip } = chipOf()
      expect(play).toHaveTextContent(/^0:21$/)
      const buttons = within(chip).getAllByRole('button')
      expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Play the voice note, 0:21', 'Original words'])
    })

  test('on its way in your bubble it cannot be played yet', () => {
    render(<VoiceBubble cls="" files={[note]} url={url} play={still} tidy top={<p>Hi</p>} busy on={on} />)
    expect(chipOf().play).toBeDisabled()
  })
})
