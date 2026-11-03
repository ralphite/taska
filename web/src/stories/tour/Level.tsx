// A recording's level in a prototype (moved from guide.tsx, D105).

/** How loud you speak, as the box's recording bar draws it. */
export const Level = () => (
  <span className="flex h-8 items-center gap-1">
    {[0.3, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.3, 0.5].map((h, i) => (
      <span key={i} className="w-1 rounded-full bg-red-500 dark:bg-red-400" style={{ height: `${h * 100}%` }} />
    ))}
  </span>
)
