import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { AppError } from '../../shared/errors'
import {
  RUNTIME_KEYS,
  type InstallProgress,
  type InstallRequest,
  type InstalledVersion,
  type RuntimeKey,
  type RuntimeStatus,
} from '../../shared/types'
import type { Release } from '../core/catalog'
import { environmentLookup, resolveCommand } from '../core/environment'
import { managedOps } from '../core/plan'
import { RUNTIMES, linkPath, managedLayout, managedPathDirs } from '../core/runtimes'
import { compareVersions, parseVersionOutput } from '../core/versions'
import { extractZip, moveDirectory, readJunction, removeDirectory, removeJunction, setJunction } from '../platform/files'
import { readEnvironment } from '../platform/registry'
import { resolveRelease } from './catalog'
import { download } from './download'
import { apply } from './environment'
import { loadSettings, log, readInstalled, storagePaths, writeInstalled, type InstalledState } from './store'

const samePath = (left: string, right: string) =>
  path.win32.normalize(left.replace(/^\\\\\?\\/, '')).toLowerCase() === path.win32.normalize(right).toLowerCase()

const targetOf = (runtime: RuntimeKey, version: InstalledVersion) =>
  path.win32.join(version.installDir, RUNTIMES[runtime].linkTarget)

function run(file: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 10 * 60_000, env: { ...process.env, ...env } }, (error, stdout, stderr) =>
      error ? reject(new AppError('install_failed', { message: stderr || error.message })) : resolve(`${stdout}\n${stderr}`),
    )
  })
}

async function detectVersion(runtime: RuntimeKey, executable: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(executable, RUNTIMES[runtime].versionArgs, { windowsHide: true, timeout: 5000 }, (_error, stdout, stderr) =>
      resolve(parseVersionOutput(`${stdout}\n${stderr}`)),
    )
  })
}

// ---------- reading ----------

export async function listRuntimes(): Promise<RuntimeStatus[]> {
  const [installed, { links }, variables] = await Promise.all([readInstalled(), storagePaths(), readEnvironment()])
  const lookup = environmentLookup(variables, process.env)
  const exists = (file: string) => existsSync(file)

  return Promise.all(
    RUNTIME_KEYS.map(async (key): Promise<RuntimeStatus> => {
      const link = linkPath(links, key)
      const current = await readJunction(link)
      const versions = [...installed[key]].sort((left, right) => compareVersions(right.version, left.version))
      const resolution = resolveCommand(variables, lookup, exists, RUNTIMES[key].executable, managedPathDirs(links, key))
      if (resolution.winner) resolution.detectedVersion = await detectVersion(key, resolution.winner.file)

      return {
        key,
        versions,
        activeId: current ? versions.find((version) => samePath(current, targetOf(key, version)))?.id : undefined,
        linkPath: link,
        resolution,
      }
    }),
  )
}

// ---------- environment ----------

/** Makes PATH and variables reflect which runtimes have at least one version installed. */
async function syncEnvironment(installed: InstalledState): Promise<void> {
  const { links } = await storagePaths()
  const enabled = new Set(RUNTIME_KEYS.filter((key) => installed[key].length > 0))
  const variables = await readEnvironment()
  await apply(variables, managedOps(variables, managedLayout(links, enabled)), 'runtimes.environment')
}

// ---------- mutations ----------

const versionId = (version: string, vendor?: string) => [vendor, version].filter(Boolean).join('-').replace(/[^\w.-]+/g, '_')

async function javaVersion(installDir: string, fallback: string): Promise<string> {
  const release = await fs.readFile(path.join(installDir, 'release'), 'utf8').catch(() => '')
  return release.match(/^JAVA_VERSION="([^"]+)"/m)?.[1] ?? fallback
}

async function installFiles(runtime: RuntimeKey, release: Release, archive: string, installDir: string): Promise<void> {
  if (release.format === 'rustup') {
    await run(archive, ['-y', '--no-modify-path', '--profile', 'default', '--default-toolchain', release.version], {
      CARGO_HOME: path.join(installDir, 'cargo'),
      RUSTUP_HOME: path.join(installDir, 'rustup'),
    })
    return
  }

  await extractZip(archive, installDir)

  if (runtime === 'python') await installPipLaunchers(path.join(installDir, 'tools'))
}

/**
 * The NuGet package ships pip as a library but without Scripts\pip.exe.
 * Reinstalling it from the bundled wheel (offline) creates the launchers.
 */
async function installPipLaunchers(home: string): Promise<void> {
  if (existsSync(path.join(home, 'Scripts', 'pip.exe'))) return
  const sitePackages = path.join(home, 'Lib', 'site-packages')
  const bundled = (await fs.readdir(sitePackages).catch(() => [] as string[])).filter(
    (name) => name === 'pip' || /^pip-.*\.dist-info$/.test(name),
  )
  await Promise.all(bundled.map((name) => fs.rm(path.join(sitePackages, name), { recursive: true, force: true })))
  await run(path.join(home, 'python.exe'), ['-m', 'ensurepip', '--default-pip'])
}

export async function install(
  request: InstallRequest,
  onProgress: (progress: InstallProgress) => void,
): Promise<InstalledVersion> {
  const { runtime } = request
  const report = (progress: Omit<InstallProgress, 'runtime'>) => onProgress({ runtime, ...progress })
  const [release, paths, settings] = await Promise.all([resolveRelease(request), storagePaths(), loadSettings()])

  report({ phase: 'download', received: 0 })
  const archive = await download(
    release,
    paths.downloads,
    (received, total) => report({ phase: 'download', received, total }),
    () => report({ phase: 'verify' }),
  )

  report({ phase: 'extract' })
  const staging = path.join(paths.runtimes, runtime, `.installing-${Date.now()}`)
  try {
    await installFiles(runtime, release, archive, staging)
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true })
    throw error
  }

  const version = runtime === 'java' ? await javaVersion(staging, release.version) : release.version
  const id = versionId(version, release.vendor)
  const installDir = path.join(paths.runtimes, runtime, id)
  await removeDirectory(installDir)
  await moveDirectory(staging, installDir)
  if (!settings.keepDownloads) await fs.rm(archive, { force: true })

  report({ phase: 'configure' })
  const entry: InstalledVersion = { id, version, vendor: release.vendor, installDir, installedAt: new Date().toISOString() }
  const installed = await readInstalled()
  installed[runtime] = [...installed[runtime].filter((item) => item.id !== id), entry]
  await writeInstalled(installed)
  await setJunction(linkPath(paths.links, runtime), targetOf(runtime, entry))
  await syncEnvironment(installed)
  await log('runtime.install', `${runtime} ${version}`)

  return entry
}

async function find(runtime: RuntimeKey, id: string): Promise<{ installed: InstalledState; version: InstalledVersion }> {
  const installed = await readInstalled()
  const version = installed[runtime].find((item) => item.id === id)
  if (!version) throw new AppError('not_found', { runtime, id })
  return { installed, version }
}

/** Switching only retargets the junction; PATH and variables already point at it. */
export async function switchVersion(runtime: RuntimeKey, id: string): Promise<void> {
  const [{ version }, { links }] = await Promise.all([find(runtime, id), storagePaths()])
  await setJunction(linkPath(links, runtime), targetOf(runtime, version))
  await log('runtime.switch', `${runtime} ${version.version}`)
}

export async function uninstall(runtime: RuntimeKey, id: string): Promise<void> {
  const [{ installed, version }, { links }] = await Promise.all([find(runtime, id), storagePaths()])
  const link = linkPath(links, runtime)
  const wasActive = samePath((await readJunction(link)) ?? '', targetOf(runtime, version))
  const remaining = installed[runtime].filter((item) => item.id !== id)

  // Delete first: if a running program holds the files, nothing else has changed yet.
  await removeDirectory(version.installDir)
  if (wasActive) {
    const next = remaining.sort((left, right) => compareVersions(right.version, left.version))[0]
    if (next) await setJunction(link, targetOf(runtime, next))
    else await removeJunction(link)
  }
  installed[runtime] = remaining
  await writeInstalled(installed)
  await syncEnvironment(installed)
  await log('runtime.uninstall', `${runtime} ${version.version}`)
}

/** The storage root can only move while it holds nothing, so installed runtimes never dangle. */
export async function assertStorageEmpty(): Promise<void> {
  const installed = await readInstalled()
  if (RUNTIME_KEYS.some((key) => installed[key].length > 0)) throw new AppError('storage_locked')
}
