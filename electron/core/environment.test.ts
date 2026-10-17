import { describe, expect, it } from 'vitest'

import type { EnvVar } from '../../shared/types'
import { analyzePath, environmentLookup, fixPath, isEssential, removeEntry, resolveCommand } from './environment'

const vars = (machinePath: string, userPath: string, extra: EnvVar[] = []): EnvVar[] => [
  { scope: 'machine', name: 'Path', value: machinePath, kind: 'ExpandString' },
  { scope: 'user', name: 'Path', value: userPath, kind: 'ExpandString' },
  ...extra,
]

const normalize = (file: string) => (/^[a-z]:\\$/i.test(file) ? file : file.replace(/\\+$/, '')).toLowerCase()

/** A fake file system that knows only the given paths. */
const fileSystem = (...paths: string[]) => {
  const known = new Set(paths.map(normalize))
  return (file: string) => known.has(normalize(file))
}

const processEnv = { SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\me' }

describe('environmentLookup', () => {
  it('prefers user values over machine values and expands nested references', () => {
    const lookup = environmentLookup(
      [
        { scope: 'machine', name: 'JAVA_HOME', value: 'C:\\jdk8', kind: 'String' },
        { scope: 'user', name: 'java_home', value: '%USERPROFILE%\\jdk21', kind: 'ExpandString' },
      ],
      processEnv,
    )
    expect(lookup('JAVA_HOME')).toBe('C:\\Users\\me\\jdk21')
    expect(lookup('systemroot')).toBe('C:\\Windows')
    expect(lookup('MISSING')).toBeUndefined()
  })
})

describe('analyzePath', () => {
  const exists = fileSystem('C:\\', 'C:\\Windows\\System32', 'C:\\Tools', 'C:\\Users\\me\\bin')

  it('flags empty, duplicate, missing and quoted entries in search order', () => {
    const issues = analyzePath(
      vars('%SystemRoot%\\System32;;C:\\Gone', 'C:\\Windows\\System32\\;"C:\\Tools";C:\\Users\\me\\bin;'),
      environmentLookup([], processEnv),
      exists,
    )
    expect(issues.map(({ scope, index, kind }) => [scope, index, kind])).toEqual([
      ['machine', 1, 'empty'],
      ['machine', 2, 'missing'],
      ['user', 0, 'duplicate'],
      ['user', 1, 'quoted'],
    ])
    expect(issues.every((issue) => issue.recommended)).toBe(true)
  })

  it('never recommends removing entries it cannot check', () => {
    const issues = analyzePath(
      vars('', 'E:\\usb\\bin;%NOT_SET%\\bin;\\\\server\\share\\bin'),
      environmentLookup([], processEnv),
      exists,
    )
    expect(issues.map(({ entry, kind, recommended }) => [entry, kind, recommended])).toEqual([
      ['E:\\usb\\bin', 'unverifiable', false],
      ['%NOT_SET%\\bin', 'unverifiable', false],
    ])
  })
})

describe('fixPath', () => {
  it('removes selected entries and unquotes quoted ones, leaving the rest untouched', () => {
    const env = vars('A;B', '"C:\\Tools";D;D;%X%')
    const issues = analyzePath(env, environmentLookup([], {}), fileSystem('C:\\', 'C:\\Tools'))
    const fixes = fixPath(
      env,
      issues.filter((issue) => issue.scope === 'user' && (issue.kind === 'quoted' || issue.kind === 'duplicate')),
    )
    expect(fixes.get('user')).toBe('C:\\Tools;D;%X%')
    expect(fixes.has('machine')).toBe(false)
  })
})

describe('removeEntry', () => {
  it('matches entries regardless of case, quotes and trailing slashes', () => {
    expect(removeEntry(vars('C:\\Oracle\\javapath\\;C:\\Windows', ''), 'machine', '"c:\\oracle\\JAVAPATH"')).toBe('C:\\Windows')
  })
})

describe('isEssential', () => {
  it('protects the Windows folder and everything under it', () => {
    const lookup = environmentLookup([], processEnv)
    expect(isEssential('C:\\WINDOWS\\system32\\', lookup)).toBe(true)
    expect(isEssential('C:\\Windows', lookup)).toBe(true)
    expect(isEssential('C:\\WindowsApps', lookup)).toBe(false)
  })
})

describe('resolveCommand', () => {
  const managed = 'C:\\EnvPilot\\links\\java\\bin'
  const exists = fileSystem('C:\\Oracle\\javapath\\java.exe', `${managed}\\java.exe`, 'C:\\Windows\\System32\\where.exe')

  it('reports machine entries that hide the managed runtime', () => {
    const result = resolveCommand(
      vars('C:\\Oracle\\javapath;%SystemRoot%\\System32', managed),
      environmentLookup([], processEnv),
      exists,
      'java.exe',
      [managed],
    )
    expect(result.winner?.file).toBe('C:\\Oracle\\javapath\\java.exe')
    expect(result.shadowing).toEqual([
      { scope: 'machine', entry: 'C:\\Oracle\\javapath', file: 'C:\\Oracle\\javapath\\java.exe', essential: false },
    ])
  })

  it('has nothing shadowing when the managed entry wins', () => {
    const result = resolveCommand(vars('', `${managed};C:\\Oracle\\javapath`), environmentLookup([], {}), exists, 'java.exe', [managed])
    expect(result.winner?.file).toBe(`${managed}\\java.exe`)
    expect(result.shadowing).toEqual([])
    expect(result.managed).toBe(true)
  })
})
