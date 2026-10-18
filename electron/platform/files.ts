import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { AppError } from '../../shared/errors'
import { runScript } from './powershell'

export async function pathExists(target: string): Promise<boolean> {
  return fs.lstat(target).then(
    () => true,
    () => false,
  )
}

/** Points `link` at `target`, replacing whatever junction was there. Never touches the old target's files. */
export async function setJunction(link: string, target: string): Promise<void> {
  await removeJunction(link)
  await fs.mkdir(path.dirname(link), { recursive: true })
  await fs.symlink(target, link, 'junction')
}

export async function removeJunction(link: string): Promise<void> {
  const stat = await fs.lstat(link).catch(() => null)
  if (!stat) return
  if (!stat.isSymbolicLink()) throw new AppError('unknown', { message: `${link} is not a junction.` })
  await fs.unlink(link)
}

export async function readJunction(link: string): Promise<string | undefined> {
  return fs.readlink(link).catch(() => undefined)
}

export function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })
}

const TAR = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')

/**
 * Extracts a zip with the bsdtar that ships with Windows 10+, which is far
 * faster than Expand-Archive. Archives that wrap everything in one top-level
 * folder are unwrapped so `destination` holds the runtime directly.
 */
export async function extractZip(archive: string, destination: string): Promise<void> {
  const staging = `${destination}.partial`
  await fs.rm(staging, { recursive: true, force: true })
  await fs.mkdir(staging, { recursive: true })

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(TAR, ['-xf', archive, '-C', staging], { windowsHide: true }, (error, _stdout, stderr) =>
        error ? reject(new AppError('install_failed', { message: stderr || error.message })) : resolve(),
      )
    })

    const items = await fs.readdir(staging, { withFileTypes: true })
    const root = items.length === 1 && items[0].isDirectory() ? path.join(staging, items[0].name) : staging

    await removeDirectory(destination)
    await moveDirectory(root, destination)
  } finally {
    await fs.rm(staging, { recursive: true, force: true })
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const LOCKED = new Set(['EBUSY', 'EPERM', 'EACCES'])

/**
 * Retries file operations that fail because something briefly holds the files,
 * typically an antivirus scanner inspecting a freshly extracted runtime.
 */
async function whenUnlocked(operation: () => Promise<void>): Promise<boolean> {
  for (const delay of [0, 300, 1000, 2500]) {
    await sleep(delay)
    try {
      await operation()
      return true
    } catch (error) {
      if (!LOCKED.has((error as NodeJS.ErrnoException).code ?? '')) throw error
    }
  }
  return false
}

export async function moveDirectory(from: string, to: string): Promise<void> {
  if (!(await whenUnlocked(() => fs.rename(from, to)))) {
    throw new AppError('install_failed', { message: `Could not move ${from}; it is in use.` })
  }
}

/** Deletes a directory, retrying briefly; reports the processes holding it if that fails. */
export async function removeDirectory(target: string): Promise<void> {
  if (await whenUnlocked(() => fs.rm(target, { recursive: true, force: true }))) return
  const { names } = await runScript<{ names: string[] }>(
    `$prefix = [string]$Payload
$names = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { "$($_.Name) ($($_.ProcessId))" }
@{ names = @($names) }`,
    { input: target },
  )
  throw new AppError('runtime_in_use', { processes: names.join(', ') || '?' })
}
