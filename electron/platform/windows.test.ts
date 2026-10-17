/**
 * Integration tests against the real Windows registry and file system.
 * They run on the Windows CI runner and are skipped elsewhere.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { extractZip, readJunction, removeJunction, setJunction } from './files'
import { readEnvironment, writeEnvironment } from './registry'

const NAME = 'ENVPILOT_TEST_VALUE'

describe.runIf(process.platform === 'win32')('Windows integration', () => {
  afterAll(async () => {
    await writeEnvironment([{ scope: 'user', name: NAME, value: null, kind: 'String' }])
  })

  it('reads the user and machine Path without expanding variables', async () => {
    const vars = await readEnvironment()
    const machinePath = vars.find((item) => item.scope === 'machine' && item.name.toLowerCase() === 'path')
    expect(machinePath?.kind).toBe('ExpandString')
    expect(machinePath?.value).toMatch(/%SystemRoot%/i)
  }, 30_000)

  it('writes values verbatim and keeps REG_EXPAND_SZ', async () => {
    const value = '%USERPROFILE%\\envpilot-测试;C:\\Path With Spaces\\\'quote\''
    await writeEnvironment([{ scope: 'user', name: NAME, value, kind: 'ExpandString' }])

    const stored = (await readEnvironment()).find((item) => item.scope === 'user' && item.name === NAME)
    expect(stored).toEqual({ scope: 'user', name: NAME, value, kind: 'ExpandString' })

    const raw = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', NAME], { encoding: 'utf8' })
    expect(raw).toContain('REG_EXPAND_SZ')
  }, 30_000)

  // GitHub's Windows runners are administrators without a UAC prompt, so the elevated path can run here.
  it.runIf(process.env.CI)('writes machine scope through the elevated runner', async () => {
    await writeEnvironment([{ scope: 'machine', name: NAME, value: 'machine-value', kind: 'String' }])
    const stored = (await readEnvironment()).find((item) => item.scope === 'machine' && item.name === NAME)
    expect(stored?.value).toBe('machine-value')
    await writeEnvironment([{ scope: 'machine', name: NAME, value: null, kind: 'String' }])
  }, 60_000)

  it('creates, retargets and removes junctions without touching their targets', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'envpilot-junction-'))
    const [first, second, link] = ['v1', 'v2', 'current'].map((name) => path.join(root, name))
    await fs.mkdir(first)
    await fs.mkdir(second)
    await fs.writeFile(path.join(first, 'marker'), 'one')

    await setJunction(link, first)
    expect(await fs.readFile(path.join(link, 'marker'), 'utf8')).toBe('one')

    await setJunction(link, second)
    expect((await readJunction(link))?.toLowerCase()).toContain('v2')

    await removeJunction(link)
    expect(await fs.readFile(path.join(first, 'marker'), 'utf8')).toBe('one')
    await fs.rm(root, { recursive: true, force: true })
  })

  it('extracts a zip and unwraps a single top-level folder', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'envpilot-zip-'))
    await fs.mkdir(path.join(root, 'src', 'jdk-21', 'bin'), { recursive: true })
    await fs.writeFile(path.join(root, 'src', 'jdk-21', 'bin', 'java.txt'), 'java')
    const archive = path.join(root, 'jdk.zip')
    execFileSync('tar', ['-a', '-cf', archive, '-C', path.join(root, 'src'), 'jdk-21'])

    const destination = path.join(root, 'out')
    await extractZip(archive, destination)
    expect(await fs.readFile(path.join(destination, 'bin', 'java.txt'), 'utf8')).toBe('java')
    await fs.rm(root, { recursive: true, force: true })
  })
})
