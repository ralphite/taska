// T457: the page gets the whole height; the add-on panel opens from the toolbar when wanted.
// F528: every component story shows the desktop and the phone at once, so the toolbar has no screen-size picker; light
// or dark is one button that switches between them.
import { addons, types, useGlobals } from 'storybook/manager-api'
import { IconButton } from 'storybook/internal/components'
import { MoonIcon, SunIcon } from '@storybook/icons'
import { createElement } from 'react'

addons.setConfig({
  showPanel: false,
  toolbar: {
    'storybook/viewport': { hidden: true },
    'storybook/viewport/tool': { hidden: true },
  },
})

// the manager's bundle compiles JSX the classic way, so the elements are made with createElement
function SchemeButton() {
  const [globals, updateGlobals] = useGlobals()
  const dark = globals.scheme === 'dark'
  return createElement(
    IconButton,
    {
      key: 'scheme',
      title: dark ? 'Dark: switch to light' : 'Light: switch to dark',
      onClick: () => updateGlobals({ scheme: dark ? 'light' : 'dark' }),
    },
    createElement(dark ? MoonIcon : SunIcon),
  )
}
addons.register('taska/scheme', () => {
  addons.add('taska/scheme/tool', {
    type: types.TOOL,
    title: 'Light or dark',
    match: ({ viewMode }) => viewMode === 'story',
    render: SchemeButton,
  })
})
