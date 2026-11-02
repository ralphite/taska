// The helpers Sidebar's stories share: how each draws its part.

/** Marks a row as the page's own code does while you press it or drag it. */
export const mark = (slug: string, attr: string) => (root: HTMLElement) => root.querySelector(`a[data-slug="${slug}"]`)?.setAttribute(attr, '')
