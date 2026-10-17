/**
 * Turns each vendor's public release index into installable releases.
 * Parsers are pure so they can be tested against recorded responses.
 */
import type { CatalogEntry, JavaVendor } from '../../shared/types'
import { latestPerGroup } from './versions'

export type Arch = 'x64' | 'arm64'

export interface Release extends CatalogEntry {
  url: string
  /** Name to store the download under; always `.zip` for archives. */
  fileName: string
  sha256?: string
  /** A file published next to the download that contains its SHA-256. */
  sha256Url?: string
  format: 'zip' | 'rustup'
}

const LIMIT = 6

const minor = (version: string) => version.split('.').slice(0, 2).join('.')
const major = (version: string) => version.split('.')[0]

// ---------- Node.js: https://nodejs.org/dist/index.json ----------

export interface NodeIndexItem {
  version: string
  lts: string | false
  files: string[]
}

export function parseNode(index: readonly NodeIndexItem[], arch: Arch): Release[] {
  const releases = index
    .filter((item) => item.files.includes(`win-${arch}-zip`))
    .map((item): Release & { lts: boolean } => {
      const version = item.version.replace(/^v/, '')
      const fileName = `node-v${version}-win-${arch}.zip`
      const base = `https://nodejs.org/dist/v${version}`
      return {
        version,
        channel: item.lts ? `LTS ${item.lts}` : 'Current',
        lts: Boolean(item.lts),
        url: `${base}/${fileName}`,
        fileName,
        sha256Url: `${base}/SHASUMS256.txt`,
        format: 'zip',
      }
    })
  // Odd-numbered "Current" lines reach end of life quickly; offer only the newest one plus LTS lines.
  return latestPerGroup(releases, (item) => item.version, (item) => major(item.version))
    .filter((item, index) => index === 0 || item.lts)
    .slice(0, LIMIT)
}

// ---------- Go: https://go.dev/dl/?mode=json&include=all ----------

export interface GoIndexItem {
  version: string
  stable: boolean
  files: Array<{ filename: string; os: string; arch: string; kind: string; sha256: string }>
}

export function parseGo(index: readonly GoIndexItem[], arch: Arch): Release[] {
  const goArch = arch === 'arm64' ? 'arm64' : 'amd64'
  const releases = index
    .filter((item) => item.stable)
    .flatMap((item): Release[] => {
      const file = item.files.find((f) => f.os === 'windows' && f.arch === goArch && f.kind === 'archive')
      if (!file) return []
      return [
        {
          version: item.version.replace(/^go/, ''),
          channel: 'Stable',
          url: `https://go.dev/dl/${file.filename}`,
          fileName: file.filename,
          sha256: file.sha256,
          format: 'zip',
        },
      ]
    })
  return latestPerGroup(releases, (item) => item.version, (item) => minor(item.version)).slice(0, LIMIT)
}

// ---------- Python (NuGet package): https://api.nuget.org/v3-flatcontainer/python/index.json ----------

export function pythonPackageId(arch: Arch): string {
  return arch === 'arm64' ? 'pythonarm64' : 'python'
}

export function parsePython(index: { versions: readonly string[] }, arch: Arch): Release[] {
  const id = pythonPackageId(arch)
  const releases = index.versions
    .filter((version) => /^3\.\d+\.\d+$/.test(version))
    .map(
      (version): Release => ({
        version,
        channel: 'Stable',
        url: `https://api.nuget.org/v3-flatcontainer/${id}/${version}/${id}.${version}.nupkg`,
        fileName: `${id}-${version}.zip`,
        format: 'zip',
      }),
    )
  return latestPerGroup(releases, (item) => item.version, (item) => minor(item.version)).slice(0, 5)
}

// ---------- PHP: https://windows.php.net/downloads/releases/releases.json ----------

type PhpBuild = { zip?: { path: string; sha256?: string } }
export type PhpIndex = Record<string, { version: string } & Record<string, PhpBuild | string>>

export function parsePhp(index: PhpIndex, arch: Arch): Release[] {
  // Prefer non-thread-safe builds with the newest compiler.
  const preferred = arch === 'arm64' ? ['nts-vs17-arm64', 'ts-vs17-arm64'] : ['nts-vs17-x64', 'ts-vs17-x64', 'nts-vs16-x64', 'ts-vs16-x64']

  const releases = Object.values(index).flatMap((line): Release[] => {
    const build = preferred.map((key) => line[key]).find((value): value is PhpBuild => typeof value === 'object')
    if (!build?.zip) return []
    return [
      {
        version: line.version,
        channel: 'Stable',
        url: `https://windows.php.net/downloads/releases/${build.zip.path}`,
        fileName: build.zip.path,
        sha256: build.zip.sha256,
        format: 'zip',
      },
    ]
  })
  return latestPerGroup(releases, (item) => item.version, (item) => minor(item.version)).slice(0, 5)
}

// ---------- Rust (rustup) ----------

export function rustReleases(arch: Arch): Release[] {
  const host = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc'
  const url = `https://static.rust-lang.org/rustup/dist/${host}/rustup-init.exe`
  return ['stable', 'beta', 'nightly'].map((channel) => ({
    version: channel,
    channel: channel[0].toUpperCase() + channel.slice(1),
    url,
    fileName: `rustup-init-${host}.exe`,
    sha256Url: `${url}.sha256`,
    format: 'rustup',
  }))
}

// ---------- Java ----------

export const JAVA_MAJORS: Record<JavaVendor, string[]> = {
  temurin: ['25', '21', '17', '11', '8'],
  microsoft: ['25', '21', '17', '11'],
  // Oracle only publishes "latest" builds under its free licence for current releases.
  oracle: ['25', '21'],
}

const LTS = new Set(['8', '11', '17', '21', '25'])

export function javaCatalog(vendor: JavaVendor): CatalogEntry[] {
  return JAVA_MAJORS[vendor].map((version) => ({ version, vendor, channel: LTS.has(version) ? 'LTS' : 'Current' }))
}

export interface AdoptiumAsset {
  binary: { package: { link: string; name: string; checksum: string } }
  version: { openjdk_version: string }
}

export function adoptiumUrl(majorVersion: string, arch: Arch): string {
  const jdkArch = arch === 'arm64' ? 'aarch64' : 'x64'
  return `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot?architecture=${jdkArch}&image_type=jdk&os=windows&vendor=eclipse`
}

export function parseAdoptium(assets: readonly AdoptiumAsset[], majorVersion: string): Release | undefined {
  const asset = assets.find((item) => item.binary.package.name.endsWith('.zip'))
  if (!asset) return undefined
  return {
    version: majorVersion,
    vendor: 'temurin',
    channel: 'LTS',
    url: asset.binary.package.link,
    fileName: asset.binary.package.name,
    sha256: asset.binary.package.checksum,
    format: 'zip',
  }
}

export function vendorJavaRelease(vendor: 'microsoft' | 'oracle', majorVersion: string, arch: Arch): Release {
  if (vendor === 'microsoft') {
    const fileName = `microsoft-jdk-${majorVersion}-windows-${arch === 'arm64' ? 'aarch64' : 'x64'}.zip`
    const url = `https://aka.ms/download-jdk/${fileName}`
    return { version: majorVersion, vendor, channel: 'LTS', url, fileName, sha256Url: `${url}.sha256sum.txt`, format: 'zip' }
  }
  const fileName = `jdk-${majorVersion}_windows-${arch === 'arm64' ? 'aarch64' : 'x64'}_bin.zip`
  const url = `https://download.oracle.com/java/${majorVersion}/latest/${fileName}`
  return { version: majorVersion, vendor, channel: 'LTS', url, fileName: `oracle-${fileName}`, sha256Url: `${url}.sha256`, format: 'zip' }
}

/** Finds the SHA-256 for `fileName` in a checksum file (`<hash>  <name>` lines or a bare hash). */
export function pickChecksum(text: string, fileName: string): string | undefined {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const named = lines.find((line) => line.endsWith(fileName))
  const hash = (named ?? (lines.length === 1 ? lines[0] : ''))?.match(/\b[a-f0-9]{64}\b/i)?.[0]
  return hash?.toLowerCase()
}
