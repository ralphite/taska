// Stories of sheets: each sheet's parts in its frame, on the phone and the desktop.

import type { ReactNode } from 'react'
import { Frames } from './Frames'
import { Sheet, SheetLayout, type SheetLook, type SheetParts } from '../ui/Sheet'

export const no = () => {}

export function SheetFrames({ parts, look = {}, height = 640, phone = true, desk = true }: { parts: (layout: 'phone' | 'desk') => SheetParts; look?: SheetLook; height?: number; phone?: boolean; desk?: boolean }): ReactNode {
  return (
    <Frames height={height} phone={phone} desk={desk} deskWidth={900}>
      {(layout) => <Sheet open look={look} desk={layout === 'desk'} onClose={no}><SheetLayout {...parts(layout)} /></Sheet>}
    </Frames>
  )
}
