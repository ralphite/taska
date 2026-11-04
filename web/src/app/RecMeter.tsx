// The recording's time and level, as a place picked to comment on shows them while it records (B498): read on its
// own, so what holds it is not drawn again at every moment of sound.

import { clock } from '../model/time'
import { RecBar } from '../ui/PlaceVoice'
import { useStores, useStoreValue } from './context'

/** `n`: how many moments of the level it shows. */
export function RecMeter({ n }: { n: number }) {
  const stores = useStores('recording')
  const ms = useStoreValue(stores.recording, (s) => s.rec?.ms ?? null)
  const levels = useStoreValue(stores.recording, (s) => s.rec?.levels)
  if (ms == null) return null
  const shown = (levels ?? []).slice(-n)
  return <RecBar time={clock(ms)} levels={[...Array(Math.max(0, n - shown.length)).fill(0.08), ...shown]} />
}
