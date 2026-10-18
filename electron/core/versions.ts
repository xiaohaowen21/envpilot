/** Compares dotted versions numerically: `1.10.0` > `1.9.2`, `21.0.2+13` > `21.0.2`. */
export function compareVersions(left: string, right: string): number {
  const parts = (value: string) => value.split(/[^\d]+/).filter(Boolean).map(Number)
  const a = parts(left)
  const b = parts(right)

  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0)
    if (delta !== 0) return delta
  }
  return 0
}

export const newestFirst = (left: string, right: string) => compareVersions(right, left)

/** Keeps the newest release of each group, e.g. one per major line. */
export function latestPerGroup<T>(items: readonly T[], version: (item: T) => string, group: (item: T) => string): T[] {
  const best = new Map<string, T>()
  for (const item of items) {
    const key = group(item)
    const current = best.get(key)
    if (!current || compareVersions(version(item), version(current)) > 0) best.set(key, item)
  }
  return [...best.values()].sort((left, right) => compareVersions(version(right), version(left)))
}

/** Pulls the first version-looking token out of tool output such as `java -version`. */
export function parseVersionOutput(output: string): string | undefined {
  return output.match(/"(\d[^"]*)"/)?.[1] ?? output.match(/\d+(?:\.\d+){1,3}/)?.[0]
}
