// T457: the page gets the whole height; the add-on panel opens from the toolbar when wanted
import { addons } from 'storybook/manager-api'

addons.setConfig({ showPanel: false })
