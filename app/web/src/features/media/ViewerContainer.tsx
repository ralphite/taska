// The picture viewer with the page: open while the route has it (Back closes it), on the picture the media service
// shows.

import { useApp, useStoreValue } from '../../app/context'
import { Viewer } from './Viewer'

export function ViewerContainer() {
  const app = useApp()
  const open = useStoreValue(app.stores.route, (s) => s.layers.includes('viewer'))
  const v = useStoreValue(app.stores.media, (s) => s.viewer)
  const f = v.group[v.idx] || ''
  return (
    <Viewer
      open={open}
      name={f.replace(/^f\d+-/, '')}
      url={f ? `/p/${encodeURIComponent(v.slug)}/f/${encodeURIComponent(f)}` : ''}
      idx={v.idx}
      count={v.group.length}
      fit={v.fit}
      on={{ close: () => app.media.close(), prev: () => app.media.step(-1), next: () => app.media.step(1), zoom: () => app.media.zoom() }}
    />
  )
}
