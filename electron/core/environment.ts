import path from 'node:path'

import type { CommandResolution, EnvVar, PathHit, PathIssue, Scope } from '../../shared/types'
import {
  createLookup,
  expandVars,
  hasUnresolvedVars,
  joinPath,
  normalizeDir,
  sameDir,
  splitPath,
  unquote,
  type Lookup,
} from './path-list'

export type Exists = (file: string) => boolean

/** Windows builds the effective PATH as the machine value followed by the user value. */
export const SCOPE_ORDER: readonly Scope[] = ['machine', 'user']

export function findVar(vars: readonly EnvVar[], scope: Scope, name: string): EnvVar | undefined {
  return vars.find((item) => item.scope === scope && item.name.toLowerCase() === name.toLowerCase())
}

export function getPath(vars: readonly EnvVar[], scope: Scope): string {
  return findVar(vars, scope, 'Path')?.value ?? ''
}

/**
 * Resolves `%NAME%` the way a freshly started process would see it:
 * user values over machine values over the inherited process environment.
 */
export function environmentLookup(vars: readonly EnvVar[], processEnv: Record<string, string | undefined>): Lookup {
  const byScope = (scope: Scope) =>
    Object.fromEntries(vars.filter((item) => item.scope === scope).map((item) => [item.name, item.value]))
  const raw = createLookup(byScope('user'), byScope('machine'), processEnv)
  // Values may reference other variables (JAVA_HOME=%ProgramFiles%\...); one extra pass covers real-world nesting.
  return (name) => {
    const value = raw(name)
    return value === undefined ? undefined : expandVars(value, raw)
  }
}

export interface PathEntry {
  scope: Scope
  index: number
  entry: string
  expanded: string
}

export function effectivePath(vars: readonly EnvVar[], lookup: Lookup): PathEntry[] {
  return SCOPE_ORDER.flatMap((scope) =>
    splitPath(getPath(vars, scope)).map((entry, index) => ({
      scope,
      index,
      entry,
      expanded: unquote(expandVars(entry, lookup)),
    })),
  )
}

function issueId(item: PathEntry): string {
  return `${item.scope}|${item.index}|${item.entry}`
}

function isNetworkPath(expanded: string): boolean {
  return expanded.startsWith('\\\\')
}

function canVerify(expanded: string, exists: Exists): boolean {
  if (hasUnresolvedVars(expanded)) return false
  const root = path.win32.parse(expanded).root
  // A missing drive is usually removable media; don't call its entries dead.
  return root !== '' && exists(root)
}

export function analyzePath(vars: readonly EnvVar[], lookup: Lookup, exists: Exists): PathIssue[] {
  const seen = new Set<string>()
  const issues: PathIssue[] = []

  for (const item of effectivePath(vars, lookup)) {
    const report = (kind: PathIssue['kind'], recommended: boolean) =>
      issues.push({ id: issueId(item), scope: item.scope, index: item.index, entry: item.entry, kind, recommended })

    if (item.entry.trim() === '') {
      report('empty', true)
      continue
    }

    const key = normalizeDir(item.expanded)
    if (seen.has(key)) {
      report('duplicate', true)
      continue
    }
    seen.add(key)

    // Probing a network share can hang for seconds, so leave those alone.
    if (isNetworkPath(item.expanded)) continue
    if (!canVerify(item.expanded, exists)) {
      report('unverifiable', false)
      continue
    }
    if (!exists(item.expanded)) {
      report('missing', true)
      continue
    }
    if (item.entry.includes('"')) report('quoted', true)
  }

  return issues
}

/** Applies the selected fixes and returns the new PATH value for each scope that changed. */
export function fixPath(vars: readonly EnvVar[], selected: readonly PathIssue[]): Map<Scope, string> {
  const changed = new Map<Scope, string>()

  for (const scope of SCOPE_ORDER) {
    const fixes = new Map(selected.filter((issue) => issue.scope === scope).map((issue) => [issue.index, issue]))
    if (fixes.size === 0) continue

    const entries = splitPath(getPath(vars, scope)).flatMap((entry, index) => {
      const issue = fixes.get(index)
      if (!issue) return [entry]
      return issue.kind === 'quoted' ? [unquote(entry)] : []
    })
    changed.set(scope, joinPath(entries))
  }

  return changed
}

/** Directories under the Windows folder must never be removed from PATH. */
export function isEssential(expanded: string, lookup: Lookup): boolean {
  const windows = normalizeDir(lookup('SystemRoot') ?? 'C:\\Windows')
  const dir = normalizeDir(expanded)
  return dir === windows || dir.startsWith(`${windows}\\`)
}

export function removeEntry(vars: readonly EnvVar[], scope: Scope, target: string): string {
  return joinPath(splitPath(getPath(vars, scope)).filter((entry) => !sameDir(entry, target)))
}

/** Lists every PATH directory that provides `fileName`, in the order Windows searches them. */
export function resolveCommand(
  vars: readonly EnvVar[],
  lookup: Lookup,
  exists: Exists,
  fileName: string,
  managedDirs: readonly string[],
): CommandResolution {
  const hits: PathHit[] = effectivePath(vars, lookup)
    .filter((item) => item.expanded !== '' && !isNetworkPath(item.expanded))
    .filter((item) => exists(path.win32.join(item.expanded, fileName)))
    .map((item) => ({
      scope: item.scope,
      entry: item.entry,
      file: path.win32.join(item.expanded, fileName),
      essential: isEssential(item.expanded, lookup),
    }))
    .filter((hit, index, list) => list.findIndex((other) => sameDir(other.file, hit.file)) === index)

  const managedIndex = hits.findIndex((hit) =>
    managedDirs.some((dir) => sameDir(path.win32.dirname(hit.file), dir)),
  )

  return {
    command: fileName,
    winner: hits[0],
    shadowing: managedIndex > 0 ? hits.slice(0, managedIndex) : [],
    managed: managedIndex === 0,
  }
}
