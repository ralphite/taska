// The page's tooltip on buttons (T591: Floating > Tip): its words in the page's own look, a key at the end as a key
// cap, beside the sidebar's buttons, under the heads' buttons, above the rest.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { headOf } from './headFixtures'
import { listOf, PROJECT } from './listFixtures'
import { rail, side } from './sideFixtures'
import { button, one } from './tipFixtures'

export default { title: 'Components/Around the page/Floating/Tip/On buttons' } satisfies Meta
type Story = StoryObj

export const OnApprove: Story = { ...one(() => listOf(PROJECT, 'items', {}, true), button('[data-n="3"]', 'Approve'), { height: 520 }), name: 'On Approve, in a row that waits on you' }
export const OnHideSidebar: Story = { ...one(() => <div className="h-full w-60">{side(false)}</div>, 'button[aria-label="Hide sidebar"]', { height: 520 }), name: 'On Hide sidebar' }
export const OnRailProject: Story = { ...one(() => <div className="h-full w-14">{rail()}</div>, '#rail a[aria-label="Home"]', { height: 520 }), name: 'On a project in the rail' }
export const OnRailSettings: Story = { ...one(() => <div className="h-full w-14">{rail()}</div>, '#rail button[aria-label="Settings"]', { height: 520 }), name: 'On Settings in the rail' }
export const OnFilters: Story = { ...one(() => headOf(true), 'button[aria-label="Filters"]', { width: 1100, height: 240 }), name: 'On Filters' }
/** the agent pill: its agents and their sessions, one line each */
export const OnTheAgentPill: Story = { ...one(() => headOf(true), (root) => [...root.querySelectorAll('button')].find((b) => /ready|now|ago|waiting|away/i.test(b.textContent ?? '')), { width: 1100, height: 260 }), name: 'On the agent pill: its agents and sessions' }
