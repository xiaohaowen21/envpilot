import type { EnvChange, EnvVar, Scope } from '../../shared/types'
import { findVar, getPath } from './environment'
import { joinPath, sameDir, splitPath } from './path-list'

/** A single registry write. `value: null` deletes the variable. */
export interface EnvOp {
  scope: Scope
  name: string
  value: string | null
  kind: EnvVar['kind']
}

function kindFor(vars: readonly EnvVar[], scope: Scope, name: string, value: string): EnvVar['kind'] {
  const existing = findVar(vars, scope, name)
  if (existing) return existing.kind
  return name.toLowerCase() === 'path' || value.includes('%') ? 'ExpandString' : 'String'
}

export function setOp(vars: readonly EnvVar[], scope: Scope, name: string, value: string | null): EnvOp | null {
  const existing = findVar(vars, scope, name)
  if (value === null) {
    return existing ? { scope, name: existing.name, value: null, kind: existing.kind } : null
  }
  if (existing?.value === value) return null
  return { scope, name: existing?.name ?? name, value, kind: kindFor(vars, scope, name, value) }
}

export function compact(ops: ReadonlyArray<EnvOp | null>): EnvOp[] {
  return ops.filter((op): op is EnvOp => op !== null)
}

export function toChanges(vars: readonly EnvVar[], ops: readonly EnvOp[]): EnvChange[] {
  return ops.map((op) => ({
    scope: op.scope,
    name: op.name,
    before: findVar(vars, op.scope, op.name)?.value,
    after: op.value ?? undefined,
  }))
}

/** Operations that bring `current` back to exactly what `snapshot` recorded. */
export function restoreOps(current: readonly EnvVar[], snapshot: readonly EnvVar[]): EnvOp[] {
  const ops: EnvOp[] = []

  for (const saved of snapshot) {
    const live = findVar(current, saved.scope, saved.name)
    if (!live || live.value !== saved.value || live.kind !== saved.kind) {
      ops.push({ scope: saved.scope, name: saved.name, value: saved.value, kind: saved.kind })
    }
  }
  for (const live of current) {
    if (!findVar(snapshot, live.scope, live.name)) {
      ops.push({ scope: live.scope, name: live.name, value: null, kind: live.kind })
    }
  }

  return ops
}

export interface ManagedLayout {
  /** PATH directories EnvPilot wants first in the user PATH, in order. */
  pathDirs: string[]
  /** Every directory EnvPilot could ever add, used to clear stale entries. */
  knownPathDirs: string[]
  /** Variables to set, or `null` to remove when they still hold `owned`. */
  variables: Array<{ name: string; value: string | null; owned: string }>
}

/** User-scope operations that make the registry match EnvPilot's layout. */
export function managedOps(vars: readonly EnvVar[], layout: ManagedLayout): EnvOp[] {
  const current = getPath(vars, 'user')
  const others = splitPath(current).filter(
    (entry) => !layout.knownPathDirs.some((dir) => sameDir(dir, entry)),
  )
  const desiredPath = joinPath([...layout.pathDirs, ...others])
  const pathOp = desiredPath === current ? null : setOp(vars, 'user', 'Path', desiredPath)

  const variableOps = layout.variables.map(({ name, value, owned }) => {
    if (value !== null) return setOp(vars, 'user', name, value)
    // Only remove a variable we set ourselves; someone else's JAVA_HOME stays.
    const existing = findVar(vars, 'user', name)
    return existing && sameDir(existing.value, owned) ? setOp(vars, 'user', name, null) : null
  })

  return compact([pathOp, ...variableOps])
}
