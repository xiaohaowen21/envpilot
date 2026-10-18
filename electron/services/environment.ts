import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { AppError } from '../../shared/errors'
import type { EnvChange, EnvironmentReport, EnvVar, Scope, SnapshotInfo } from '../../shared/types'
import { analyzePath, environmentLookup, fixPath, isEssential, removeEntry } from '../core/environment'
import { expandVars } from '../core/path-list'
import { compact, restoreOps, setOp, toChanges, type EnvOp } from '../core/plan'
import { readEnvironment, writeEnvironment } from '../platform/registry'
import { log, snapshotsDir, writeJson } from './store'

const exists = (file: string) => existsSync(file)
const SNAPSHOT_LIMIT = 50

export async function report(): Promise<EnvironmentReport> {
  const variables = await readEnvironment()
  const issues = analyzePath(variables, environmentLookup(variables, process.env), exists)
  return { variables, issues }
}

/**
 * The single way EnvPilot changes environment variables: snapshot first,
 * write everything in one go, then record what happened.
 */
export async function apply(vars: readonly EnvVar[], ops: readonly EnvOp[], action: string): Promise<EnvChange[]> {
  if (ops.length === 0) return []
  await saveSnapshot(vars, action)
  await writeEnvironment(ops)
  const changes = toChanges(vars, ops)
  await log(action, changes.map((change) => `${change.scope}:${change.name}`).join(', '))
  return changes
}

export async function cleanup(issueIds: readonly string[]): Promise<EnvChange[]> {
  const { variables, issues } = await report()
  const selected = issues.filter((issue) => issueIds.includes(issue.id))
  const ops = [...fixPath(variables, selected)].map(([scope, value]) => setOp(variables, scope, 'Path', value))
  return apply(variables, compact(ops), 'path.cleanup')
}

export async function removePathEntry(scope: Scope, entry: string): Promise<EnvChange[]> {
  const variables = await readEnvironment()
  const lookup = environmentLookup(variables, process.env)
  if (isEssential(expandVars(entry, lookup), lookup)) throw new AppError('invalid_input', { entry })
  return apply(variables, compact([setOp(variables, scope, 'Path', removeEntry(variables, scope, entry))]), 'path.remove')
}

// ---------- snapshots ----------

const snapshotSchema = z.object({
  createdAt: z.string(),
  reason: z.string(),
  variables: z.array(
    z.object({
      scope: z.enum(['user', 'machine']),
      name: z.string(),
      value: z.string(),
      kind: z.enum(['String', 'ExpandString']),
    }),
  ),
})

type Snapshot = z.infer<typeof snapshotSchema>

const SNAPSHOT_ID = /^[\w-]+$/

function snapshotFile(id: string): string {
  // Ids come from the renderer; only bare names inside the snapshots folder are accepted.
  if (!SNAPSHOT_ID.test(id)) throw new AppError('invalid_input', { id })
  return path.join(snapshotsDir(), `${id}.json`)
}

async function loadSnapshot(id: string): Promise<Snapshot> {
  const text = await fs.readFile(snapshotFile(id), 'utf8').catch(() => {
    throw new AppError('not_found', { id })
  })
  return snapshotSchema.parse(JSON.parse(text))
}

async function saveSnapshot(variables: readonly EnvVar[], reason: string): Promise<SnapshotInfo> {
  const createdAt = new Date().toISOString()
  const id = createdAt.replace(/[:.]/g, '-')
  await writeJson(snapshotFile(id), { createdAt, reason, variables: [...variables] } satisfies Snapshot)
  await prune()
  return { id, createdAt, reason, variableCount: variables.length }
}

async function prune(): Promise<void> {
  const files = (await fs.readdir(snapshotsDir())).filter((file) => file.endsWith('.json')).sort()
  await Promise.all(files.slice(0, -SNAPSHOT_LIMIT).map((file) => fs.rm(path.join(snapshotsDir(), file))))
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const files = await fs.readdir(snapshotsDir()).catch(() => [] as string[])
  const infos = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const id = file.slice(0, -'.json'.length)
        try {
          const { createdAt, reason, variables } = await loadSnapshot(id)
          return [{ id, createdAt, reason, variableCount: variables.length }]
        } catch {
          return []
        }
      }),
  )
  return infos.flat().sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function createSnapshot(): Promise<SnapshotInfo> {
  const info = await saveSnapshot(await readEnvironment(), 'manual')
  await log('snapshot.create')
  return info
}

export async function diffSnapshot(id: string): Promise<EnvChange[]> {
  const [snapshot, variables] = await Promise.all([loadSnapshot(id), readEnvironment()])
  return toChanges(variables, restoreOps(variables, snapshot.variables))
}

export async function restoreSnapshot(id: string): Promise<EnvChange[]> {
  const [snapshot, variables] = await Promise.all([loadSnapshot(id), readEnvironment()])
  return apply(variables, restoreOps(variables, snapshot.variables), 'snapshot.restore')
}

export async function deleteSnapshot(id: string): Promise<void> {
  await fs.rm(snapshotFile(id), { force: true })
}
