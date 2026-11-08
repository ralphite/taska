// Where a place's comment buttons float (B715 r1169): over the page, never in its flow, so opening or closing them
// moves no words. Under the place when the screen has room for them there; else over it when it has room there; else
// under it all the same (a place taller than the screen, or one out of sight).

/** A span from top to bottom, in the screen's pixels. */
export interface Span {
  top: number
  bottom: number
}

/** The buttons go over the place, not under it. */
export function floatOver(place: Span, height: number, gap: number, shown: Span): boolean {
  if (place.bottom + gap + height <= shown.bottom || place.top >= shown.bottom || place.bottom <= shown.top) return false
  return place.top - gap - height >= shown.top
}
