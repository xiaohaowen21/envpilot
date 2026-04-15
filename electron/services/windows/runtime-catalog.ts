import os from 'node:os'

import type {
  JavaVendor,
  ManagedRuntimeKey,
  RuntimeCatalogOption,
} from '../../../shared/contracts'
import { fetchJson, fetchText } from './http-client'

interface NodeRelease {
  files: string[]
  lts: false | string
  version: string
}

interface AdoptiumPackage {
  binary: {
    package: {
      link: string
    }
  }
  version: {
    openjdk_version: string
  }
}

interface GoRelease {
  files: Array<{
    arch: string
    filename: string
    kind: string
    os: string
  }>
  stable: boolean
  version: string
}

interface PhpZipAsset {
  path: string
}

interface PhpBuildAsset {
  zip?: PhpZipAsset
}

type PhpReleaseCatalog = Record<string, { version: string } & Record<string, PhpBuildAsset | string>>

const JAVA_CATALOGS: Array<Pick<RuntimeCatalogOption, 'channel' | 'label' | 'version'>> = [
  { channel: 'Current', label: 'Java 25', version: '25' },
  { channel: 'LTS', label: 'Java 21', version: '21' },
  { channel: 'LTS', label: 'Java 17', version: '17' },
  { channel: 'LTS', label: 'Java 11', version: '11' },
  { channel: 'Legacy LTS', label: 'Java 8', version: '8' },
]

export const JAVA_VENDOR_SUPPORT: Record<JavaVendor, { label: string; supportedVersions: string[] }> = {
  microsoft: {
    label: 'Microsoft Build of OpenJDK',
    supportedVersions: ['25', '21', '17', '11'],
  },
  oracle: {
    label: 'Oracle JDK',
    supportedVersions: ['25', '21', '17', '11', '8'],
  },
  temurin: {
    label: 'Eclipse Temurin',
    supportedVersions: ['25', '21', '17', '11', '8'],
  },
}

function getWindowsArch(): 'x64' | 'arm64' {
  return os.arch() === 'arm64' ? 'arm64' : 'x64'
}

function getOracleArch(): 'x64' | 'aarch64' {
  return getWindowsArch() === 'arm64' ? 'aarch64' : 'x64'
}

function getGoArch(): 'amd64' | 'arm64' {
  return getWindowsArch() === 'arm64' ? 'arm64' : 'amd64'
}

function getRustHostTriple(): 'aarch64-pc-windows-msvc' | 'x86_64-pc-windows-msvc' {
  return getWindowsArch() === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc'
}

function compareVersions(left: string, right: string): number {
  const normalize = (value: string) =>
    value
      .replace(/[^\d.]/g, '')
      .split('.')
      .map((part) => Number(part))
  const leftParts = normalize(left)
  const rightParts = normalize(right)
  const maxLength = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)

    if (delta !== 0) {
      return delta
    }
  }

  return 0
}

async function resolveNodeCatalogs(): Promise<RuntimeCatalogOption[]> {
  const arch = getWindowsArch()
  const assetName = arch === 'arm64' ? 'win-arm64-zip' : 'win-x64-zip'
  const releases = await fetchJson<NodeRelease[]>('https://nodejs.org/dist/index.json')
  const byMajor = new Map<string, RuntimeCatalogOption>()

  for (const release of releases) {
    if (!release.files.includes(assetName)) {
      continue
    }

    const version = release.version.replace(/^v/, '')
    const major = version.split('.')[0]

    if (byMajor.has(major)) {
      continue
    }

    byMajor.set(major, {
      channel: release.lts ? `LTS ${release.lts}` : 'Current',
      downloadUrl: `https://nodejs.org/dist/${release.version}/node-${release.version}-win-${arch}.zip`,
      label: `Node.js ${version}`,
      version,
    })

    if (byMajor.size >= 6) {
      break
    }
  }

  return [...byMajor.values()].sort((left, right) => compareVersions(right.version, left.version))
}

async function resolvePythonCatalogs(): Promise<RuntimeCatalogOption[]> {
  const arch = getWindowsArch()
  const directoryContent = await fetchText('https://www.python.org/ftp/python/')
  const versions = Array.from(directoryContent.matchAll(/href="(3\.\d+\.\d+)\/"/g)).map(
    (match) => match[1],
  )
  const minorPriority = ['3.13', '3.12', '3.11', '3.10', '3.9']
  const selected: RuntimeCatalogOption[] = []

  for (const minorVersion of minorPriority) {
    const latestPatch = versions
      .filter((version) => version.startsWith(`${minorVersion}.`))
      .sort((left, right) => compareVersions(right, left))[0]

    if (!latestPatch) {
      continue
    }

    selected.push({
      channel: latestPatch.startsWith('3.13') ? 'Stable' : 'Legacy',
      downloadUrl: `https://www.python.org/ftp/python/${latestPatch}/python-${latestPatch}-${arch}.zip`,
      label: `Python ${latestPatch}`,
      version: latestPatch,
    })
  }

  return selected
}

async function resolveGoCatalogs(): Promise<RuntimeCatalogOption[]> {
  const arch = getGoArch()
  const releases = await fetchJson<GoRelease[]>('https://go.dev/dl/?mode=json')
  const selected: RuntimeCatalogOption[] = []
  const seenMinor = new Set<string>()

  for (const release of releases) {
    const file = release.files.find(
      (item) => item.os === 'windows' && item.arch === arch && item.kind === 'archive',
    )

    if (!file) {
      continue
    }

    const version = release.version.replace(/^go/, '')
    const minor = version.split('.').slice(0, 2).join('.')

    if (seenMinor.has(minor)) {
      continue
    }

    seenMinor.add(minor)
    selected.push({
      channel: release.stable ? 'Stable' : 'Preview',
      downloadUrl: `https://go.dev/dl/${file.filename}`,
      label: `Go ${version}`,
      version,
    })

    if (selected.length >= 5) {
      break
    }
  }

  return selected.sort((left, right) => compareVersions(right.version, left.version))
}

function extractRustVersion(manifest: string): string | undefined {
  return manifest
    .match(/\[pkg\.rust\][\s\S]*?version = "([^"]+)"/)?.[1]
    ?.match(/\d+\.\d+\.\d+/)?.[0]
}

async function resolveRustCatalogs(): Promise<RuntimeCatalogOption[]> {
  const host = getRustHostTriple()
  const installerUrl = `https://static.rust-lang.org/rustup/dist/${host}/rustup-init.exe`
  const [stableManifest, betaManifest, nightlyManifest] = await Promise.all([
    fetchText('https://static.rust-lang.org/dist/channel-rust-stable.toml'),
    fetchText('https://static.rust-lang.org/dist/channel-rust-beta.toml'),
    fetchText('https://static.rust-lang.org/dist/channel-rust-nightly.toml'),
  ])

  const stableVersion = extractRustVersion(stableManifest)
  const betaVersion = extractRustVersion(betaManifest)
  const nightlyVersion = extractRustVersion(nightlyManifest)

  return [
    {
      channel: 'Stable',
      downloadUrl: installerUrl,
      installerType: 'executable',
      label: stableVersion ? `Rust ${stableVersion}` : 'Rust stable',
      version: 'stable',
    },
    {
      channel: betaVersion ? `Beta ${betaVersion}` : 'Beta',
      downloadUrl: installerUrl,
      installerType: 'executable',
      label: betaVersion ? `Rust beta (${betaVersion})` : 'Rust beta',
      version: 'beta',
    },
    {
      channel: nightlyVersion ? `Nightly ${nightlyVersion}` : 'Nightly',
      downloadUrl: installerUrl,
      installerType: 'executable',
      label: nightlyVersion ? `Rust nightly (${nightlyVersion})` : 'Rust nightly',
      version: 'nightly',
    },
  ]
}

function getPhpBuildAsset(
  release: PhpReleaseCatalog[string],
  arch: 'x64' | 'arm64',
): PhpBuildAsset | null {
  const candidateKeys =
    arch === 'arm64'
      ? ['nts-vs17-arm64', 'ts-vs17-arm64']
      : [
          'nts-vs17-x64',
          'ts-vs17-x64',
          'nts-vc16-x64',
          'ts-vc16-x64',
          'nts-vc15-x64',
          'ts-vc15-x64',
        ]

  for (const key of candidateKeys) {
    const candidate = release[key]

    if (candidate && typeof candidate === 'object' && 'zip' in candidate) {
      return candidate as PhpBuildAsset
    }
  }

  return null
}

async function resolvePhpCatalogs(): Promise<RuntimeCatalogOption[]> {
  const arch = getWindowsArch()
  const releases = await fetchJson<PhpReleaseCatalog>(
    'https://windows.php.net/downloads/releases/releases.json',
  )

  return Object.entries(releases)
    .sort(([left], [right]) => compareVersions(right, left))
    .map(([, release]) => {
      const build = getPhpBuildAsset(release, arch)

      if (!build?.zip?.path) {
        return null
      }

      return {
        channel:
          release.version.startsWith('8.5.')
            ? 'Current'
            : release.version.startsWith('8.4.')
              ? 'Stable'
              : 'Legacy',
        downloadUrl: `https://windows.php.net/downloads/releases/${build.zip.path}`,
        label: `PHP ${release.version}`,
        version: release.version,
      } satisfies RuntimeCatalogOption
    })
    .filter((item): item is RuntimeCatalogOption => item !== null)
    .slice(0, 5)
}

async function resolveTemurinCatalog(majorVersion: string): Promise<RuntimeCatalogOption> {
  const arch = getWindowsArch()
  const packages = await fetchJson<AdoptiumPackage[]>(
    `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot?architecture=${arch}&heap_size=normal&image_type=jdk&os=windows&vendor=eclipse`,
  )
  const selected = packages[0]

  if (!selected) {
    throw new Error(`No Eclipse Temurin package found for Java ${majorVersion}.`)
  }

  return {
    channel: JAVA_CATALOGS.find((item) => item.version === majorVersion)?.channel ?? 'Stable',
    downloadUrl: selected.binary.package.link,
    label: `Eclipse Temurin ${selected.version.openjdk_version}`,
    vendor: 'temurin',
    version: selected.version.openjdk_version,
  }
}

function resolveOracleCatalog(majorVersion: string): RuntimeCatalogOption {
  const arch = getOracleArch()

  return {
    channel: JAVA_CATALOGS.find((item) => item.version === majorVersion)?.channel ?? 'Stable',
    downloadUrl: `https://download.oracle.com/java/${majorVersion}/latest/jdk-${majorVersion}_windows-${arch}_bin.zip`,
    label: `Oracle JDK ${majorVersion}`,
    vendor: 'oracle',
    version: majorVersion,
  }
}

function resolveMicrosoftCatalog(majorVersion: string): RuntimeCatalogOption {
  const arch = getWindowsArch()

  return {
    channel: JAVA_CATALOGS.find((item) => item.version === majorVersion)?.channel ?? 'Stable',
    downloadUrl: `https://aka.ms/download-jdk/microsoft-jdk-${majorVersion}-windows-${arch}.zip`,
    label: `Microsoft Build of OpenJDK ${majorVersion}`,
    vendor: 'microsoft',
    version: majorVersion,
  }
}

export function getSupportedJavaVersions(vendor: JavaVendor): string[] {
  return JAVA_VENDOR_SUPPORT[vendor].supportedVersions
}

export async function resolveJavaInstallCatalog(
  majorVersion: string,
  vendor: JavaVendor,
): Promise<RuntimeCatalogOption> {
  if (!getSupportedJavaVersions(vendor).includes(majorVersion)) {
    throw new Error(`${JAVA_VENDOR_SUPPORT[vendor].label} does not provide Java ${majorVersion}.`)
  }

  if (vendor === 'temurin') {
    return resolveTemurinCatalog(majorVersion)
  }

  if (vendor === 'oracle') {
    return resolveOracleCatalog(majorVersion)
  }

  return resolveMicrosoftCatalog(majorVersion)
}

async function resolveJavaCatalogs(): Promise<RuntimeCatalogOption[]> {
  return JAVA_CATALOGS.map((catalog) => ({
    ...catalog,
    downloadUrl: '',
  }))
}

export async function getRuntimeCatalogs(runtime: ManagedRuntimeKey): Promise<RuntimeCatalogOption[]> {
  if (runtime === 'java') {
    return resolveJavaCatalogs()
  }

  if (runtime === 'node') {
    return resolveNodeCatalogs()
  }

  if (runtime === 'python') {
    return resolvePythonCatalogs()
  }

  if (runtime === 'go') {
    return resolveGoCatalogs()
  }

  if (runtime === 'rust') {
    return resolveRustCatalogs()
  }

  return resolvePhpCatalogs()
}
