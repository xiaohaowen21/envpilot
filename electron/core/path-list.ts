/** Pure helpers for Windows PATH-style lists. Nothing here touches the system. */

export type Lookup = (name: string) => string | undefined

export function splitPath(value: string): string[] {
  if (value === '') return []
  const entries = value.split(';')
  // A single trailing `;` is common and harmless; don't report it as an empty entry.
  if (entries.length > 1 && entries[entries.length - 1] === '') {
    entries.pop()
  }
  return entries
}

export function joinPath(entries: readonly string[]): string {
  return entries.join(';')
}

export function unquote(entry: string): string {
  return entry.trim().replace(/^"+|"+$/g, '')
}

/** Expands `%NAME%` references; unknown names are left as they are. */
export function expandVars(value: string, lookup: Lookup): string {
  return value.replace(/%([^%;]+)%/g, (match, name: string) => lookup(name) ?? match)
}

export function hasUnresolvedVars(value: string): boolean {
  return /%[^%;]+%/.test(value)
}

/** Canonical form used to compare two entries: unquoted, no trailing slash, case-folded. */
export function normalizeDir(path: string): string {
  return unquote(path).replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

export function sameDir(left: string, right: string): boolean {
  return normalizeDir(left) === normalizeDir(right)
}

/** Builds a case-insensitive lookup where earlier sources win. */
export function createLookup(...sources: ReadonlyArray<Record<string, string | undefined>>): Lookup {
  const table = new Map<string, string>()
  for (const source of [...sources].reverse()) {
    for (const [name, value] of Object.entries(source)) {
      if (value !== undefined) table.set(name.toLowerCase(), value)
    }
  }
  return (name) => table.get(name.toLowerCase())
}
