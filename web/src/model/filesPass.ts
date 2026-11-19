// A web page document's frame is no site (its sandbox keeps its scripts away from Taska), so what it asks Taska for
// carries no cookie and comes cross-site: refused (B790: its sounds would not play). The project's files pass, put on
// each address of one of the project's files the page names, lets the frame have those files and nothing else.

/** `html` with every address of one of project `slug`'s files (`/p/<slug>/f/<name>`, with or without this Taska's
 * address and key in front) made the frame's: `/p/<slug>/f/<name>?cap=<pass>`. Unchanged without a pass. */
export function withFilesPass(html: string, slug: string, cap: string): string {
  if (!cap) return html
  const at = new RegExp(`(?:https?://[^\\s"'()<>/]+)?(?:/k/[A-Za-z0-9-]+)?/p/${slug.replace(/[^\w-]/g, '')}/f/([^\\s"'()<>?#\\\\]+)(?:\\?cap=[0-9a-f]*)?`, 'g')
  return html.replace(at, (_, name: string) => `/p/${slug}/f/${name}?cap=${cap}`)
}

/** The address of file `f` of project `slug`. With the project's files pass, it opens anywhere the key is not (B828:
 * on the iPhone, Taska added to the Home Screen opens a document's PDF in a browser window of its own, without the key,
 * so it came to the sign-in page). */
export function fileUrl(slug: string, f: string, cap = ''): string {
  const at = `/p/${encodeURIComponent(slug)}/f/${encodeURIComponent(f)}`
  return cap ? `${at}?cap=${cap}` : at
}
