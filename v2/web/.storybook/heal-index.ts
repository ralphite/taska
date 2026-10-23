// B517: Storybook's story list must never stay broken after files move. Two faults in Storybook's own index
// (storybook 10.6, StoryIndexGenerator) left the dev server answering "Unable to index files" until it was restarted,
// which is why agents kept restarting it:
// - a folder of stories renamed or removed: its watcher hears only that the folder went, so the files in it stay in
//   the index for good (as stories whose file is gone, or as the duplicates of their new copies);
// - a story file that turns up while the index is being made is read in the next step as an MDX docs page, which
//   fails ("Could not parse expression with acorn") and stays failed.
// Here, each time the index is asked for, files that no longer exist leave it, and a story file is always read as
// stories. Storybook's dev server loads this file with main.ts, in the same process, so the patch is on the class it
// uses.
import { existsSync } from 'node:fs'
import { StoryIndexGenerator } from 'storybook/internal/core-server'

type Entry = unknown
type Generator = {
  specifierToCache: Map<unknown, Record<string, Entry>>
  lastIndex?: unknown
  lastError?: unknown
  invalidationListeners: Set<() => void>
  isDocsMdx(path: string): boolean
  extractStories(specifier: unknown, path: string, tags?: string[]): Promise<Entry>
  extractDocs(specifier: unknown, path: string, tags?: string[]): Promise<Entry>
  getIndexAndStats(): Promise<unknown>
}

const proto = StoryIndexGenerator.prototype as unknown as Generator & { taskaHealed?: boolean }
if (!proto.taskaHealed) {
  proto.taskaHealed = true

  const extractDocs = proto.extractDocs
  proto.extractDocs = function (this: Generator, specifier, path, tags) {
    return this.isDocsMdx(path)
      ? extractDocs.call(this, specifier, path, tags)
      : this.extractStories(specifier, path, tags)
  }

  const getIndexAndStats = proto.getIndexAndStats
  proto.getIndexAndStats = function (this: Generator) {
    let gone = 0
    for (const cache of this.specifierToCache.values())
      for (const path of Object.keys(cache))
        if (!existsSync(path)) {
          delete cache[path]
          gone++
        }
    if (gone) {
      console.log(`Storybook index: ${gone} file(s) no longer there, taken out (B517)`)
      this.lastIndex = null
      this.lastError = null
      this.invalidationListeners.forEach((listener) => listener())
    }
    return getIndexAndStats.call(this)
  }
}
