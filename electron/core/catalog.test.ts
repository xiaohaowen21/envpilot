import { describe, expect, it } from 'vitest'

import { parseGo, parseNode, parsePhp, parsePython, pickChecksum } from './catalog'
import { compareVersions, parseVersionOutput } from './versions'

describe('compareVersions', () => {
  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('21.0.2+13', '21.0.2')).toBeGreaterThan(0)
    expect(compareVersions('3.12', '3.12.0')).toBe(0)
  })
})

describe('parseVersionOutput', () => {
  it('reads the version from typical tool output', () => {
    expect(parseVersionOutput('openjdk version "21.0.5" 2024-10-15 LTS')).toBe('21.0.5')
    expect(parseVersionOutput('v22.11.0')).toBe('22.11.0')
    expect(parseVersionOutput('go version go1.23.2 windows/amd64')).toBe('1.23.2')
    expect(parseVersionOutput('Python was not found')).toBeUndefined()
  })
})

describe('parseNode', () => {
  it('keeps the newest release per major line that ships a Windows zip', () => {
    const releases = parseNode(
      [
        { version: 'v23.1.0', lts: false, files: ['win-x64-zip'] },
        { version: 'v22.11.0', lts: 'Jod', files: ['win-x64-zip', 'win-arm64-zip'] },
        { version: 'v22.10.0', lts: false, files: ['win-x64-zip'] },
        { version: 'v21.7.3', lts: false, files: ['win-x64-zip'] },
        { version: 'v20.18.0', lts: 'Iron', files: ['linux-x64'] },
      ],
      'x64',
    )
    expect(releases.map((item) => [item.version, item.channel])).toEqual([
      ['23.1.0', 'Current'],
      ['22.11.0', 'LTS Jod'],
    ])
    expect(releases[1].url).toBe('https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip')
    expect(releases[1].sha256Url).toBe('https://nodejs.org/dist/v22.11.0/SHASUMS256.txt')
  })
})

describe('parseGo', () => {
  it('picks the Windows archive for the architecture and carries its checksum', () => {
    const file = (filename: string, arch: string, kind = 'archive') => ({ filename, os: 'windows', arch, kind, sha256: `sha-${filename}` })
    const releases = parseGo(
      [
        { version: 'go1.23.2', stable: true, files: [file('go1.23.2.windows-amd64.zip', 'amd64'), file('go1.23.2.windows-amd64.msi', 'amd64', 'installer')] },
        { version: 'go1.23.1', stable: true, files: [file('go1.23.1.windows-amd64.zip', 'amd64')] },
        { version: 'go1.24rc1', stable: false, files: [file('go1.24rc1.windows-amd64.zip', 'amd64')] },
        { version: 'go1.22.8', stable: true, files: [file('go1.22.8.windows-arm64.zip', 'arm64')] },
      ],
      'x64',
    )
    expect(releases.map((item) => [item.version, item.sha256])).toEqual([['1.23.2', 'sha-go1.23.2.windows-amd64.zip']])
  })
})

describe('parsePython', () => {
  it('keeps the newest stable patch per minor version and stores the package as a zip', () => {
    const releases = parsePython({ versions: ['3.12.6', '3.12.7', '3.13.0', '3.14.0-rc1', '3.13.0b1'] }, 'x64')
    expect(releases.map((item) => item.version)).toEqual(['3.13.0', '3.12.7'])
    expect(releases[0].fileName).toBe('python-3.13.0.zip')
    expect(releases[0].url).toBe('https://api.nuget.org/v3-flatcontainer/python/3.13.0/python.3.13.0.nupkg')
  })
})

describe('parsePhp', () => {
  it('prefers the non-thread-safe build', () => {
    const [release] = parsePhp(
      {
        '8.3': {
          version: '8.3.12',
          'ts-vs16-x64': { zip: { path: 'php-8.3.12-Win32-vs16-x64.zip', sha256: 'ts' } },
          'nts-vs16-x64': { zip: { path: 'php-8.3.12-nts-Win32-vs16-x64.zip', sha256: 'nts' } },
        },
      },
      'x64',
    )
    expect(release.fileName).toBe('php-8.3.12-nts-Win32-vs16-x64.zip')
    expect(release.sha256).toBe('nts')
  })
})

describe('pickChecksum', () => {
  const hash = 'a'.repeat(64)
  it('finds the line for the file in a SHASUMS list', () => {
    expect(pickChecksum(`${'b'.repeat(64)}  other.zip\n${hash}  node.zip\n`, 'node.zip')).toBe(hash)
  })
  it('accepts a bare hash file', () => {
    expect(pickChecksum(`${hash.toUpperCase()}\n`, 'jdk.zip')).toBe(hash)
  })
  it('returns nothing when the file is not listed', () => {
    expect(pickChecksum(`${hash}  a.zip\n${hash}  b.zip`, 'c.zip')).toBeUndefined()
  })
})
