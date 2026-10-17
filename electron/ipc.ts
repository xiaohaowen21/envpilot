import path from 'node:path'

import { ipcMain, shell, type WebContents } from 'electron'
import { z } from 'zod'

import { PROGRESS_EVENT, type Api, type Channel } from '../shared/api'
import { AppError, type ErrorPayload, type Result } from '../shared/errors'
import { JAVA_VENDORS, RUNTIME_KEYS, type Settings } from '../shared/types'
import * as catalog from './services/catalog'
import * as environment from './services/environment'
import * as runtimes from './services/runtimes'
import * as store from './services/store'

const runtime = z.enum(RUNTIME_KEYS)
const vendor = z.enum(JAVA_VENDORS)
const id = z.string().min(1).max(200)
const scope = z.enum(['user', 'machine'])

/** Argument schemas: everything from the renderer is validated before use. */
const schemas: { [C in Channel]: z.ZodType<Parameters<Api[C]>> } = {
  'runtimes:list': z.tuple([]),
  'runtimes:catalog': z.tuple([runtime, vendor.optional()]),
  'runtimes:install': z.tuple([z.object({ runtime, version: id, vendor: vendor.optional() })]),
  'runtimes:switch': z.tuple([runtime, id]),
  'runtimes:uninstall': z.tuple([runtime, id]),
  'env:report': z.tuple([]),
  'env:cleanup': z.tuple([z.array(z.string()).max(1000)]),
  'env:removePathEntry': z.tuple([scope, z.string().min(1)]),
  'snapshots:list': z.tuple([]),
  'snapshots:create': z.tuple([]),
  'snapshots:diff': z.tuple([id]),
  'snapshots:restore': z.tuple([id]),
  'snapshots:delete': z.tuple([id]),
  'logs:list': z.tuple([]),
  'settings:get': z.tuple([]),
  'settings:update': z.tuple([
    z
      .object({
        storageRoot: z.string().refine((value) => path.win32.isAbsolute(value), 'Must be an absolute path'),
        locale: z.enum(['zh-CN', 'en-US']),
        theme: z.enum(['system', 'light', 'dark']),
        keepDownloads: z.boolean(),
      })
      .partial(),
  ]),
  'settings:openStorage': z.tuple([]),
}

type Handlers = { [C in Channel]: (sender: WebContents, ...args: Parameters<Api[C]>) => Promise<ReturnType<Api[C]>> }

async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await store.loadSettings()
  if (patch.storageRoot && patch.storageRoot !== current.storageRoot) await runtimes.assertStorageEmpty()
  return store.saveSettings({ ...current, ...patch })
}

const handlers: Handlers = {
  'runtimes:list': () => runtimes.listRuntimes(),
  'runtimes:catalog': (_sender, key, javaVendor) => catalog.listCatalog(key, javaVendor),
  'runtimes:install': (sender, request) =>
    runtimes.install(request, (progress) => {
      if (!sender.isDestroyed()) sender.send(PROGRESS_EVENT, progress)
    }),
  'runtimes:switch': (_sender, key, versionId) => runtimes.switchVersion(key, versionId),
  'runtimes:uninstall': (_sender, key, versionId) => runtimes.uninstall(key, versionId),
  'env:report': () => environment.report(),
  'env:cleanup': (_sender, issueIds) => environment.cleanup(issueIds),
  'env:removePathEntry': (_sender, entryScope, entry) => environment.removePathEntry(entryScope, entry),
  'snapshots:list': () => environment.listSnapshots(),
  'snapshots:create': () => environment.createSnapshot(),
  'snapshots:diff': (_sender, snapshotId) => environment.diffSnapshot(snapshotId),
  'snapshots:restore': (_sender, snapshotId) => environment.restoreSnapshot(snapshotId),
  'snapshots:delete': (_sender, snapshotId) => environment.deleteSnapshot(snapshotId),
  'logs:list': () => store.readLog(),
  'settings:get': () => store.loadSettings(),
  'settings:update': (_sender, patch) => updateSettings(patch),
  'settings:openStorage': async () => {
    await shell.openPath((await store.storagePaths()).root)
  },
}

/** Channels that change the machine; only one may run at a time. */
const MUTATIONS = new Set<Channel>([
  'runtimes:install',
  'runtimes:switch',
  'runtimes:uninstall',
  'env:cleanup',
  'env:removePathEntry',
  'snapshots:restore',
  'settings:update',
])
let running: Channel | null = null

function toPayload(error: unknown): ErrorPayload {
  if (error instanceof AppError) return { code: error.code, params: error.params }
  if (error instanceof z.ZodError) return { code: 'invalid_input', params: { message: error.issues[0]?.message ?? '' } }
  return { code: 'unknown', params: { message: error instanceof Error ? error.message : String(error) } }
}

async function handle<C extends Channel>(channel: C, sender: WebContents, raw: unknown[]): Promise<Result<ReturnType<Api[C]>>> {
  const exclusive = MUTATIONS.has(channel)
  let acquired = false
  try {
    if (exclusive && running) throw new AppError('busy', { channel: running })
    if (exclusive) [running, acquired] = [channel, true]
    const args = schemas[channel].parse(raw)
    const handler = handlers[channel] as (sender: WebContents, ...args: unknown[]) => Promise<ReturnType<Api[C]>>
    return { ok: true, data: await handler(sender, ...args) }
  } catch (error) {
    const payload = toPayload(error)
    if (payload.code === 'unknown') console.error(`[${channel}]`, error)
    if (exclusive && payload.code !== 'busy') await store.log(channel, JSON.stringify(payload), 'error').catch(() => {})
    return { ok: false, error: payload }
  } finally {
    if (acquired) running = null
  }
}

export function registerIpc(): void {
  for (const channel of Object.keys(handlers) as Channel[]) {
    ipcMain.handle(channel, (event, ...args: unknown[]) => handle(channel, event.sender, args))
  }
}
