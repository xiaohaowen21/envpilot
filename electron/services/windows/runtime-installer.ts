import os from 'node:os'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  InstallRuntimeOptions,
  JavaVendor,
  ManagedRuntimeKey,
  ManagedRuntimeSummary,
  OperationResult,
  RuntimeCatalogOption,
} from '../../../shared/contracts'
import { loadConfig } from './config-manager'
import { createEnvironmentBackup, getEnvironmentVariables, getStoragePaths } from './env-manager'
import { downloadFile, type ProgressCallback } from './http-client'
import { appendOperationLog } from './operation-log'
import { runPowerShell, runPowerShellJson } from './powershell'
import {
  getRuntimeCatalogs,
  getSupportedJavaVersions,
  JAVA_VENDOR_SUPPORT,
  resolveJavaInstallCatalog,
} from './runtime-catalog'
import {
  readRuntimeState,
  removeInstalledRuntime,
  setActiveRuntimeVersion,
  upsertInstalledRuntime,
  writeRuntimeState,
} from './runtime-state'

interface RuntimeConfig {
  description: string
  label: string
  linkName: string
}

interface InstalledArtifact {
  installDir: string
  linkTarget: string
  vendor?: JavaVendor
  version: string
}

interface OccupyingProcess {
  executablePath?: string
  name: string
  processId: number
}

const runtimeConfigMap: Record<ManagedRuntimeKey, RuntimeConfig> = {
  go: {
    description: 'Install, switch, and keep multiple Go toolchains isolated with automatic GOROOT and PATH updates.',
    label: 'Go',
    linkName: 'go',
  },
  java: {
    description:
      'Install Java 8 / 11 / 17 / 21 / 25 side by side, choose the JDK vendor, and keep JAVA_HOME and PATH aligned automatically.',
    label: 'Java',
    linkName: 'java',
  },
  node: {
    description: 'Install multiple Node.js versions and switch the active entry point in one click.',
    label: 'Node.js',
    linkName: 'nodejs',
  },
  php: {
    description: 'Install PHP releases on drive D and expose the active PHP runtime to PATH automatically.',
    label: 'PHP',
    linkName: 'php',
  },
  python: {
    description:
      'Install Python archives onto drive D and wire the active Python runtime into PATH automatically.',
    label: 'Python',
    linkName: 'python',
  },
  rust: {
    description:
      'Install Rust stable / beta / nightly channels with rustup stored on drive D, then keep CARGO_HOME, RUSTUP_HOME, and PATH in sync.',
    label: 'Rust',
    linkName: 'rust',
  },
}

function getRuntimePaths(runtime: ManagedRuntimeKey, rootDir: string) {
  const config = runtimeConfigMap[runtime]
  const installRoot = path.join(rootDir, 'runtimes', runtime)
  const downloadRoot = path.join(rootDir, 'downloads', runtime)
  const linkRoot = path.join(rootDir, 'links')
  const linkPath = path.join(linkRoot, config.linkName)

  return {
    downloadRoot,
    installRoot,
    linkPath,
    rootDir,
  }
}

function getManagedPathEntries(rootDir: string, runtime: ManagedRuntimeKey): string[] {
  if (runtime === 'node') {
    return [path.join(rootDir, 'links', 'nodejs')]
  }

  if (runtime === 'java') {
    return [path.join(rootDir, 'links', 'java', 'bin')]
  }

  if (runtime === 'go') {
    return [path.join(rootDir, 'links', 'go', 'bin')]
  }

  if (runtime === 'rust') {
    return [path.join(rootDir, 'links', 'rust')]
  }

  if (runtime === 'php') {
    return [path.join(rootDir, 'links', 'php')]
  }

  return [path.join(rootDir, 'links', 'python'), path.join(rootDir, 'links', 'python', 'Scripts')]
}

function getAllManagedPathEntries(rootDir: string): string[] {
  return (Object.keys(runtimeConfigMap) as ManagedRuntimeKey[]).flatMap((runtime) =>
    getManagedPathEntries(rootDir, runtime),
  )
}

function getRuntimeLinkTarget(runtime: ManagedRuntimeKey, installDir: string): string {
  if (runtime === 'rust') {
    return path.join(installDir, 'cargo', 'bin')
  }

  return installDir
}

function getRustHostTriple(): 'aarch64-pc-windows-msvc' | 'x86_64-pc-windows-msvc' {
  return os.arch() === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc'
}

function normalizePath(value: string): string {
  return value.replace(/[\\/]+$/, '').toLowerCase()
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, '_').replace(/\+/g, '_').trim()
}

function escapeForPowerShellHereString(value: string): string {
  return value.replace(/'@/g, "'@''")
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function emitProgressStage(
  onProgress: ProgressCallback | undefined,
  stage:
    | 'preparing'
    | 'extracting'
    | 'installing'
    | 'configuring'
    | 'finalizing'
    | 'completed',
  label: string,
  detail: string,
  url = '',
): void {
  onProgress?.({
    bytesReceived: 0,
    contentLength: 0,
    detail,
    label,
    percentage: stage === 'completed' ? 100 : 0,
    stage,
    url,
  })
}

function isBusyDeleteError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.includes('EBUSY') || error.message.includes('EPERM')
}

function parseReleaseFile(content: string): Record<string, string> {
  return content.split(/\r?\n/).reduce<Record<string, string>>((accumulator, line) => {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/)

    if (match) {
      accumulator[match[1]] = match[2]
    }

    return accumulator
  }, {})
}

function inferJavaVendorFromImplementor(implementor?: string): JavaVendor | undefined {
  const normalized = implementor?.toLowerCase()

  if (!normalized) {
    return undefined
  }

  if (normalized.includes('adoptium') || normalized.includes('temurin')) {
    return 'temurin'
  }

  if (normalized.includes('microsoft')) {
    return 'microsoft'
  }

  if (normalized.includes('oracle')) {
    return 'oracle'
  }

  return undefined
}

async function readJavaReleaseMetadata(
  installDir: string,
): Promise<{ vendor?: JavaVendor; version?: string }> {
  const releaseFile = path.join(installDir, 'release')

  if (!existsSync(releaseFile)) {
    return {}
  }

  const parsed = parseReleaseFile(await fs.readFile(releaseFile, 'utf8'))

  return {
    vendor: inferJavaVendorFromImplementor(parsed.IMPLEMENTOR),
    version: parsed.FULL_VERSION || parsed.JAVA_RUNTIME_VERSION || parsed.JAVA_VERSION,
  }
}

async function extractArchive(archivePath: string, destinationDir: string): Promise<string> {
  const stagingDir = `${destinationDir}.staging`
  await fs.rm(stagingDir, { force: true, recursive: true })
  await fs.mkdir(stagingDir, { recursive: true })

  await runPowerShell(
    `Expand-Archive -LiteralPath @'\n${escapeForPowerShellHereString(archivePath)}\n'@ -DestinationPath @'\n${escapeForPowerShellHereString(stagingDir)}\n'@ -Force`,
  )

  const items = await fs.readdir(stagingDir, { withFileTypes: true })
  const directories = items.filter((item) => item.isDirectory())
  const files = items.filter((item) => item.isFile())
  const extractedRoot =
    directories.length === 1 && files.length === 0
      ? path.join(stagingDir, directories[0].name)
      : stagingDir

  await fs.rm(destinationDir, { force: true, recursive: true })
  await fs.mkdir(path.dirname(destinationDir), { recursive: true })
  await fs.rename(extractedRoot, destinationDir)

  if (existsSync(stagingDir)) {
    await fs.rm(stagingDir, { force: true, recursive: true })
  }

  return destinationDir
}

async function createOrUpdateJunction(linkPath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(linkPath), { recursive: true })
  await runPowerShell(
    `
if (Test-Path -LiteralPath @'
${escapeForPowerShellHereString(linkPath)}
'@) {
  Remove-Item -LiteralPath @'
${escapeForPowerShellHereString(linkPath)}
'@ -Force -Recurse
}
New-Item -ItemType Junction -Path @'
${escapeForPowerShellHereString(linkPath)}
'@ -Target @'
${escapeForPowerShellHereString(targetPath)}
'@ | Out-Null
`,
  )
}

async function removePathIfExists(targetPath: string): Promise<void> {
  if (!existsSync(targetPath)) {
    return
  }

  await fs.rm(targetPath, { force: true, recursive: true })
}

async function getOccupyingProcesses(installDir: string): Promise<OccupyingProcess[]> {
  const script = `
$target = @'
${escapeForPowerShellHereString(installDir)}
'@
$items = @(
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like "$target*" } |
    Select-Object @{ Name = 'name'; Expression = { [string]$_.Name } }, @{ Name = 'processId'; Expression = { [int]$_.ProcessId } }, @{ Name = 'executablePath'; Expression = { [string]$_.ExecutablePath } }
)
if ($items.Count -eq 0) {
  '[]'
} else {
  $items | ConvertTo-Json -Depth 4
}
`

  const result = await runPowerShellJson<OccupyingProcess[] | OccupyingProcess>(script)

  if (Array.isArray(result)) {
    return result
  }

  return result ? [result] : []
}

async function removeDirectoryWithRetries(targetPath: string): Promise<void> {
  const delays = [0, 400, 900]
  let lastError: unknown

  for (const delay of delays) {
    if (delay > 0) {
      await wait(delay)
    }

    try {
      await fs.rm(targetPath, { force: true, recursive: true })
      return
    } catch (error) {
      lastError = error

      if (!isBusyDeleteError(error)) {
        throw error
      }
    }
  }

  throw lastError
}

function composeManagedPath(rootDir: string, userPath: string, activeRuntimeKeys: ManagedRuntimeKey[]): string {
  const managedEntries = activeRuntimeKeys.flatMap((runtime) => getManagedPathEntries(rootDir, runtime))
  const allManagedEntries = new Set(getAllManagedPathEntries(rootDir).map(normalizePath))
  const currentEntries = userPath
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !allManagedEntries.has(normalizePath(item)))

  return [...managedEntries, ...currentEntries]
    .filter((item, index, list) => {
      const normalized = normalizePath(item)
      return normalized && list.findIndex((value) => normalizePath(value) === normalized) === index
    })
    .join(';')
}

function mergePathValues(...segments: string[]): string {
  return segments
    .flatMap((segment) => segment.split(';'))
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => {
      const normalized = normalizePath(item)
      return normalized && list.findIndex((value) => normalizePath(value) === normalized) === index
    })
    .join(';')
}

async function notifyEnvironmentChanged(): Promise<void> {
  await runPowerShell(
    `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd,
    uint Msg,
    UIntPtr wParam,
    string lParam,
    uint fuFlags,
    uint uTimeout,
    out UIntPtr lpdwResult
  );
}
"@
[UIntPtr]$result = [UIntPtr]::Zero
[void][NativeMethods]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)
`,
  )
}

function buildEnvironmentAssignments(rootDir: string, state: Awaited<ReturnType<typeof readRuntimeState>>): string {
  const activeJava = state.runtimes.java.find((item) => item.isActive)
  const activeNode = state.runtimes.node.find((item) => item.isActive)
  const activePython = state.runtimes.python.find((item) => item.isActive)
  const activeGo = state.runtimes.go.find((item) => item.isActive)
  const activePhp = state.runtimes.php.find((item) => item.isActive)
  const activeRust = state.runtimes.rust.find((item) => item.isActive)

  const setVariable = (name: string, value?: string) =>
    value
      ? `[Environment]::SetEnvironmentVariable('${name}', @'\n${escapeForPowerShellHereString(value)}\n'@, 'User')`
      : `[Environment]::SetEnvironmentVariable('${name}', $null, 'User')`

  return [
    setVariable('JAVA_HOME', activeJava ? path.join(rootDir, 'links', 'java') : undefined),
    setVariable('JDK_HOME', activeJava ? path.join(rootDir, 'links', 'java') : undefined),
    setVariable('NODE_HOME', activeNode ? path.join(rootDir, 'links', 'nodejs') : undefined),
    setVariable('PYTHON_HOME', activePython ? path.join(rootDir, 'links', 'python') : undefined),
    setVariable('PYTHONHOME', undefined),
    setVariable('GOROOT', activeGo ? path.join(rootDir, 'links', 'go') : undefined),
    setVariable('PHP_HOME', activePhp ? path.join(rootDir, 'links', 'php') : undefined),
    setVariable('CARGO_HOME', activeRust ? path.join(activeRust.installDir, 'cargo') : undefined),
    setVariable('RUSTUP_HOME', activeRust ? path.join(activeRust.installDir, 'rustup') : undefined),
  ].join('\n')
}

function syncProcessEnvironment(
  rootDir: string,
  state: Awaited<ReturnType<typeof readRuntimeState>>,
  desiredPath: string,
) {
  const activeJava = state.runtimes.java.find((item) => item.isActive)
  const activeNode = state.runtimes.node.find((item) => item.isActive)
  const activePython = state.runtimes.python.find((item) => item.isActive)
  const activeGo = state.runtimes.go.find((item) => item.isActive)
  const activePhp = state.runtimes.php.find((item) => item.isActive)
  const activeRust = state.runtimes.rust.find((item) => item.isActive)

  process.env.PATH = desiredPath
  process.env.Path = desiredPath

  if (activeJava) {
    process.env.JAVA_HOME = path.join(rootDir, 'links', 'java')
    process.env.JDK_HOME = path.join(rootDir, 'links', 'java')
  } else {
    delete process.env.JAVA_HOME
    delete process.env.JDK_HOME
  }

  if (activeNode) {
    process.env.NODE_HOME = path.join(rootDir, 'links', 'nodejs')
  } else {
    delete process.env.NODE_HOME
  }

  if (activePython) {
    process.env.PYTHON_HOME = path.join(rootDir, 'links', 'python')
  } else {
    delete process.env.PYTHON_HOME
  }

  delete process.env.PYTHONHOME

  if (activeGo) {
    process.env.GOROOT = path.join(rootDir, 'links', 'go')
  } else {
    delete process.env.GOROOT
  }

  if (activePhp) {
    process.env.PHP_HOME = path.join(rootDir, 'links', 'php')
  } else {
    delete process.env.PHP_HOME
  }

  if (activeRust) {
    process.env.CARGO_HOME = path.join(activeRust.installDir, 'cargo')
    process.env.RUSTUP_HOME = path.join(activeRust.installDir, 'rustup')
  } else {
    delete process.env.CARGO_HOME
    delete process.env.RUSTUP_HOME
  }
}

async function syncManagedEnvironment(): Promise<void> {
  const state = await readRuntimeState()
  const { rootDir } = await getStoragePaths()
  const activeRuntimeKeys = (Object.keys(state.runtimes) as ManagedRuntimeKey[]).filter((runtime) =>
    state.runtimes[runtime].some((item) => item.isActive),
  )
  const userVariables = await getEnvironmentVariables()
  const userPath =
    userVariables.find((item) => item.scope === 'user' && item.name.toLowerCase() === 'path')?.value ?? ''
  const machinePath =
    userVariables.find((item) => item.scope === 'machine' && item.name.toLowerCase() === 'path')?.value ?? ''
  const desiredUserPath = composeManagedPath(rootDir, userPath, activeRuntimeKeys)
  const desiredProcessPath = mergePathValues(desiredUserPath, machinePath)

  for (const runtime of Object.keys(runtimeConfigMap) as ManagedRuntimeKey[]) {
    const activeVersion = state.runtimes[runtime].find((item) => item.isActive)
    const linkPath = getRuntimePaths(runtime, rootDir).linkPath

    if (activeVersion) {
      await createOrUpdateJunction(linkPath, activeVersion.linkTarget ?? getRuntimeLinkTarget(runtime, activeVersion.installDir))
    } else {
      await removePathIfExists(linkPath)
    }
  }

  await runPowerShell(
    `
[Environment]::SetEnvironmentVariable('Path', @'
${escapeForPowerShellHereString(desiredUserPath)}
'@, 'User')
${buildEnvironmentAssignments(rootDir, state)}
`,
  )

  syncProcessEnvironment(rootDir, state, desiredProcessPath)
  await notifyEnvironmentChanged()
}

async function withProtectedMutation<T>(label: string, mutation: () => Promise<T>): Promise<T> {
  const previousState = await readRuntimeState()
  await createEnvironmentBackup()
  await appendOperationLog({
    createdAt: new Date().toISOString(),
    level: 'info',
    message: `${label}: environment backup created.`,
  })

  try {
    const result = await mutation()
    await syncManagedEnvironment()
    await appendOperationLog({
      createdAt: new Date().toISOString(),
      level: 'info',
      message: `${label}: completed successfully.`,
    })
    return result
  } catch (error) {
    await writeRuntimeState(previousState)

    try {
      await syncManagedEnvironment()
    } catch {
      // Keep the original error and let the operation log explain the failed rollback sync.
    }

    await appendOperationLog({
      createdAt: new Date().toISOString(),
      level: 'error',
      message: `${label}: failed and rolled back. ${error instanceof Error ? error.message : String(error)}`,
    })
    throw error
  }
}

async function resolveCatalogOption(
  runtime: ManagedRuntimeKey,
  options?: InstallRuntimeOptions,
): Promise<RuntimeCatalogOption> {
  if (runtime === 'java') {
    const version = options?.version ?? '25'
    const vendor = options?.javaVendor ?? 'temurin'
    return resolveJavaInstallCatalog(version, vendor)
  }

  const catalogs = await getRuntimeCatalogs(runtime)

  if (!options?.version) {
    const firstCatalog = catalogs[0]

    if (!firstCatalog) {
      throw new Error(`No installable ${runtimeConfigMap[runtime].label} version was found.`)
    }

    return firstCatalog
  }

  const matched = catalogs.find((catalog) => catalog.version === options.version)

  if (!matched) {
    throw new Error(
      `No ${runtimeConfigMap[runtime].label} version matched ${options.version}.`,
    )
  }

  return matched
}

function getJavaInstallDir(root: string, vendor: JavaVendor, version: string): string {
  return path.join(root, vendor, sanitizePathSegment(version))
}

async function installArchiveRuntime(
  runtime: ManagedRuntimeKey,
  catalog: RuntimeCatalogOption,
  archivePath: string,
  installRoot: string,
): Promise<InstalledArtifact> {
  const tempDir = path.join(installRoot, '_staging', `${sanitizePathSegment(catalog.version)}-${Date.now()}`)
  await extractArchive(archivePath, tempDir)

  if (runtime === 'java') {
    const metadata = await readJavaReleaseMetadata(tempDir)
    const vendor = metadata.vendor ?? catalog.vendor ?? 'temurin'
    const version = metadata.version ?? catalog.version
    const finalInstallDir = getJavaInstallDir(installRoot, vendor, version)

    if (existsSync(finalInstallDir)) {
      await fs.rm(tempDir, { force: true, recursive: true })
    } else {
      await fs.mkdir(path.dirname(finalInstallDir), { recursive: true })
      await fs.rename(tempDir, finalInstallDir)
    }

    return {
      installDir: finalInstallDir,
      linkTarget: getRuntimeLinkTarget(runtime, finalInstallDir),
      vendor,
      version,
    }
  }

  const finalInstallDir = path.join(installRoot, sanitizePathSegment(catalog.version))

  if (existsSync(finalInstallDir)) {
    await fs.rm(tempDir, { force: true, recursive: true })
  } else {
    await fs.mkdir(path.dirname(finalInstallDir), { recursive: true })
    await fs.rename(tempDir, finalInstallDir)
  }

  return {
    installDir: finalInstallDir,
    linkTarget: getRuntimeLinkTarget(runtime, finalInstallDir),
    version: catalog.version,
  }
}

async function installRustRuntime(archivePath: string, installRoot: string, channel: string) {
  const installDir = path.join(installRoot, sanitizePathSegment(channel))
  const cargoHome = path.join(installDir, 'cargo')
  const rustupHome = path.join(installDir, 'rustup')

  if (!existsSync(path.join(cargoHome, 'bin', 'rustc.exe'))) {
    await fs.mkdir(installDir, { recursive: true })
    await runPowerShell(
      `
$env:CARGO_HOME = @'
${escapeForPowerShellHereString(cargoHome)}
'@
$env:RUSTUP_HOME = @'
${escapeForPowerShellHereString(rustupHome)}
'@
& @'
${escapeForPowerShellHereString(archivePath)}
'@ -y --default-toolchain @'
${escapeForPowerShellHereString(channel)}
'@ --profile default --default-host @'
${escapeForPowerShellHereString(getRustHostTriple())}
'@ --no-modify-path
if ($LASTEXITCODE -ne 0) {
  throw "rustup-init exited with code $LASTEXITCODE."
}
`,
    )
  }

  return {
    installDir,
    linkTarget: getRuntimeLinkTarget('rust', installDir),
    version: channel,
  } satisfies InstalledArtifact
}

async function installPythonRuntime(installerPath: string, installRoot: string, version: string) {
  const installDir = path.join(installRoot, sanitizePathSegment(version))

  if (!existsSync(path.join(installDir, 'python.exe'))) {
    await fs.rm(installDir, { force: true, recursive: true })
    await fs.mkdir(installDir, { recursive: true })
    await runPowerShell(
      `
$targetDir = @'
${escapeForPowerShellHereString(installDir)}
'@
$installer = @'
${escapeForPowerShellHereString(installerPath)}
'@
$arguments = @(
  '/quiet',
  'InstallAllUsers=0',
  'PrependPath=0',
  'Include_doc=0',
  'Include_launcher=0',
  'Include_test=0',
  'Include_pip=1',
  'CompileAll=0',
  'Shortcuts=0',
  'SimpleInstall=1',
  "TargetDir=$targetDir"
)
$process = Start-Process -FilePath $installer -ArgumentList $arguments -Wait -PassThru
if ($process.ExitCode -ne 0) {
  throw "Python installer exited with code $($process.ExitCode)."
}
`,
    )
  }

  if (!existsSync(path.join(installDir, 'python.exe'))) {
    throw new Error('Python installer completed, but python.exe was not found in the managed directory.')
  }

  return {
    installDir,
    linkTarget: getRuntimeLinkTarget('python', installDir),
    version,
  } satisfies InstalledArtifact
}

function getArchiveFileName(runtime: ManagedRuntimeKey, catalog: RuntimeCatalogOption): string {
  const pathname = catalog.downloadUrl ? new URL(catalog.downloadUrl).pathname : ''
  const fromUrl = pathname.split('/').pop()

  if (fromUrl) {
    return fromUrl
  }

  const extension = catalog.installerType === 'executable' ? 'exe' : 'zip'
  return `${runtime}-${sanitizePathSegment(catalog.version)}.${extension}`
}

function getInstallSuccessMessage(
  runtime: ManagedRuntimeKey,
  artifact: InstalledArtifact,
): string {
  if (runtime === 'java' && artifact.vendor) {
    return `${JAVA_VENDOR_SUPPORT[artifact.vendor].label} ${artifact.version} is active. Entry point and environment variables were refreshed.`
  }

  return `${runtimeConfigMap[runtime].label} ${artifact.version} is active. Entry point and environment variables were refreshed.`
}

export async function getManagedRuntimeSummaries(): Promise<ManagedRuntimeSummary[]> {
  const state = await readRuntimeState()
  const config = await loadConfig()
  const { rootDir } = await getStoragePaths()
  const runtimes = Object.keys(runtimeConfigMap) as ManagedRuntimeKey[]

  return Promise.all(
    runtimes.map(async (runtime) => {
      let availableVersions: RuntimeCatalogOption[] = []

      try {
        availableVersions = await getRuntimeCatalogs(runtime)
      } catch {
        availableVersions = []
      }

      const sharedEntryPoint = getRuntimePaths(runtime, rootDir).linkPath

      return {
        availableVersions,
        description: runtimeConfigMap[runtime].description,
        installOptions:
          runtime === 'java'
            ? {
                cleanupArchiveDefault: config.downloadCleanupEnabled,
                javaVendors: (Object.keys(JAVA_VENDOR_SUPPORT) as JavaVendor[]).map((vendor) => ({
                  key: vendor,
                  label: JAVA_VENDOR_SUPPORT[vendor].label,
                  supportedVersions: getSupportedJavaVersions(vendor),
                })),
              }
            : {
                cleanupArchiveDefault: config.downloadCleanupEnabled,
              },
        installedVersions: state.runtimes[runtime]
          .slice()
          .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }))
          .map((item) => ({
            ...item,
            entryPoint: sharedEntryPoint,
          })),
        key: runtime,
        label: runtimeConfigMap[runtime].label,
        latestAvailable: availableVersions[0],
        sharedEntryPoint,
        status: state.runtimes[runtime].length > 0 ? 'ready' : 'not_installed',
      }
    }),
  )
}

export async function installManagedRuntime(
  runtime: ManagedRuntimeKey,
  options?: InstallRuntimeOptions,
  onProgress?: ProgressCallback,
): Promise<OperationResult> {
  const catalog = await resolveCatalogOption(runtime, options)
  const config = await loadConfig()
  const { rootDir } = await getStoragePaths()
  const paths = getRuntimePaths(runtime, rootDir)
  const fileName = getArchiveFileName(runtime, catalog)
  const archivePath = path.join(paths.downloadRoot, fileName)
  const shouldCleanupArchive = options?.cleanupArchive ?? config.downloadCleanupEnabled
  const runtimeLabel = runtimeConfigMap[runtime].label

  await appendOperationLog({
    createdAt: new Date().toISOString(),
    level: 'info',
    message: `${runtimeLabel} ${catalog.version}: downloading official package.`,
  })

  emitProgressStage(onProgress, 'preparing', 'Preparing install', `Preparing ${runtimeLabel} ${catalog.version}.`, catalog.downloadUrl)
  await downloadFile(catalog.downloadUrl, archivePath, onProgress)
  emitProgressStage(
    onProgress,
    runtime === 'rust' || catalog.installerType === 'executable' ? 'installing' : 'extracting',
    runtime === 'rust' || catalog.installerType === 'executable' ? 'Running installer' : 'Extracting package',
    runtime === 'rust' || catalog.installerType === 'executable'
      ? `Running the official ${runtimeLabel} installer into the managed directory.`
      : `Extracting ${runtimeLabel} into the managed directory.`,
    catalog.downloadUrl,
  )

  const artifact: InstalledArtifact =
    runtime === 'rust'
      ? await installRustRuntime(archivePath, paths.installRoot, catalog.version)
      : runtime === 'python' && catalog.installerType === 'executable'
        ? await installPythonRuntime(archivePath, paths.installRoot, catalog.version)
        : await installArchiveRuntime(runtime, catalog, archivePath, paths.installRoot)

  emitProgressStage(
    onProgress,
    'configuring',
    'Refreshing environment',
    `Updating stable entry points and environment variables for ${runtimeLabel}.`,
  )

  await withProtectedMutation(`${runtimeLabel} ${artifact.version} install`, async () => {
    await upsertInstalledRuntime(runtime, {
      addedAt: new Date().toISOString(),
      entryPoint: paths.linkPath,
      id: [runtime, artifact.vendor ?? 'default', artifact.version, artifact.installDir].join('::'),
      installDir: artifact.installDir,
      isActive: true,
      linkTarget: artifact.linkTarget,
      sourceUrl: catalog.downloadUrl,
      vendor: artifact.vendor,
      version: artifact.version,
    })
  })

  if (shouldCleanupArchive) {
    await fs.rm(archivePath, { force: true })
  }

  emitProgressStage(
    onProgress,
    'completed',
    'Install complete',
    `${runtimeLabel} ${artifact.version} is ready to use.`,
  )

  return {
    message: getInstallSuccessMessage(runtime, artifact),
    ok: true,
  }
}

export async function switchManagedRuntime(
  runtime: ManagedRuntimeKey,
  runtimeId: string,
): Promise<OperationResult> {
  const state = await readRuntimeState()
  const target = state.runtimes[runtime].find((item) => item.id === runtimeId)

  if (!target) {
    throw new Error(`No installed ${runtimeConfigMap[runtime].label} record matched the selected version.`)
  }

  await withProtectedMutation(`${runtimeConfigMap[runtime].label} ${target.version} switch`, async () => {
    await setActiveRuntimeVersion(runtime, runtimeId)
  })

  return {
    message: `${runtimeConfigMap[runtime].label} switched to ${target.version}.`,
    ok: true,
  }
}

export async function uninstallManagedRuntime(
  runtime: ManagedRuntimeKey,
  runtimeId: string,
): Promise<OperationResult> {
  const state = await readRuntimeState()
  const target = state.runtimes[runtime].find((item) => item.id === runtimeId)

  if (!target) {
    throw new Error(`No installed ${runtimeConfigMap[runtime].label} record matched the selected version.`)
  }

  await withProtectedMutation(`${runtimeConfigMap[runtime].label} ${target.version} uninstall`, async () => {
    if (target.isActive) {
      await removeInstalledRuntime(runtime, runtimeId)
      await syncManagedEnvironment()
      await wait(300)
    }

    try {
      await removeDirectoryWithRetries(target.installDir)
    } catch (error) {
      const occupyingProcesses = await getOccupyingProcesses(target.installDir)

      if (occupyingProcesses.length > 0) {
        const processSummary = occupyingProcesses
          .map((process) => `${process.name} (PID ${process.processId})`)
          .join(', ')

        throw new Error(
          `无法卸载 ${runtimeConfigMap[runtime].label} ${target.version}。仍有进程占用该版本：${processSummary}。请先关闭这些进程后再重试。`,
        )
      }

      throw error
    }

    if (!target.isActive) {
      await removeInstalledRuntime(runtime, runtimeId)
    }
  })

  return {
    message: `${runtimeConfigMap[runtime].label} ${target.version} was removed.`,
    ok: true,
  }
}
