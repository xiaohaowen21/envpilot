import os from 'node:os'

import { AppError } from '../../shared/errors'
import type { CatalogEntry, InstallRequest, JavaVendor, RuntimeKey } from '../../shared/types'
import {
  adoptiumUrl,
  javaCatalog,
  parseAdoptium,
  parseGo,
  parseNode,
  parsePhp,
  parsePython,
  pythonPackageId,
  rustReleases,
  vendorJavaRelease,
  type AdoptiumAsset,
  type Arch,
  type GoIndexItem,
  type NodeIndexItem,
  type PhpIndex,
  type Release,
} from '../core/catalog'
import { fetchJson } from './download'

const arch: Arch = os.arch() === 'arm64' ? 'arm64' : 'x64'

const sources: Record<Exclude<RuntimeKey, 'java'>, () => Promise<Release[]>> = {
  node: async () => parseNode(await fetchJson<NodeIndexItem[]>('https://nodejs.org/dist/index.json'), arch),
  go: async () => parseGo(await fetchJson<GoIndexItem[]>('https://go.dev/dl/?mode=json&include=all'), arch),
  python: async () =>
    parsePython(
      await fetchJson<{ versions: string[] }>(`https://api.nuget.org/v3-flatcontainer/${pythonPackageId(arch)}/index.json`),
      arch,
    ),
  php: async () => parsePhp(await fetchJson<PhpIndex>('https://windows.php.net/downloads/releases/releases.json'), arch),
  rust: async () => rustReleases(arch),
}

// Release indexes change rarely; keep them for the session to make the install dialog instant.
const cache = new Map<string, Promise<Release[]>>()

function releases(runtime: Exclude<RuntimeKey, 'java'>): Promise<Release[]> {
  let pending = cache.get(runtime)
  if (!pending) {
    pending = sources[runtime]()
    pending.catch(() => cache.delete(runtime))
    cache.set(runtime, pending)
  }
  return pending
}

const toEntry = ({ version, channel, vendor }: Release): CatalogEntry => ({ version, channel, vendor })

export async function listCatalog(runtime: RuntimeKey, vendor: JavaVendor = 'temurin'): Promise<CatalogEntry[]> {
  if (runtime === 'java') return javaCatalog(vendor)
  return (await releases(runtime)).map(toEntry)
}

export async function resolveRelease({ runtime, version, vendor = 'temurin' }: InstallRequest): Promise<Release> {
  if (runtime === 'java') {
    if (!javaCatalog(vendor).some((entry) => entry.version === version)) {
      throw new AppError('not_found', { runtime, version })
    }
    if (vendor !== 'temurin') return vendorJavaRelease(vendor, version, arch)
    const release = parseAdoptium(await fetchJson<AdoptiumAsset[]>(adoptiumUrl(version, arch)), version)
    if (!release) throw new AppError('not_found', { runtime, version })
    return release
  }

  const release = (await releases(runtime)).find((item) => item.version === version)
  if (!release) throw new AppError('not_found', { runtime, version })
  return release
}
