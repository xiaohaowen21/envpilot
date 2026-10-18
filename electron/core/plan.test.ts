import { describe, expect, it } from 'vitest'

import type { EnvVar } from '../../shared/types'
import { managedOps, restoreOps, setOp } from './plan'
import { managedLayout } from './runtimes'

const LINKS = 'C:\\EnvPilot\\links'
const userPath = (value: string): EnvVar => ({ scope: 'user', name: 'Path', value, kind: 'ExpandString' })

describe('setOp', () => {
  it('keeps the stored kind and skips writes that change nothing', () => {
    const vars: EnvVar[] = [{ scope: 'user', name: 'Path', value: '%USERPROFILE%\\bin', kind: 'ExpandString' }]
    expect(setOp(vars, 'user', 'PATH', '%USERPROFILE%\\bin')).toBeNull()
    expect(setOp(vars, 'user', 'PATH', 'C:\\x')).toEqual({ scope: 'user', name: 'Path', value: 'C:\\x', kind: 'ExpandString' })
  })

  it('picks a kind for new variables from their content', () => {
    expect(setOp([], 'user', 'GOPATH', 'C:\\go')?.kind).toBe('String')
    expect(setOp([], 'user', 'GOPATH', '%USERPROFILE%\\go')?.kind).toBe('ExpandString')
    expect(setOp([], 'user', 'NOPE', null)).toBeNull()
  })
})

describe('managedOps', () => {
  it('puts managed directories first and keeps every other entry exactly as written', () => {
    const ops = managedOps([userPath('%USERPROFILE%\\bin;C:\\Tools')], managedLayout(LINKS, new Set(['java', 'node'])))
    expect(ops).toEqual([
      {
        scope: 'user',
        name: 'Path',
        value: `${LINKS}\\java\\bin;${LINKS}\\node;%USERPROFILE%\\bin;C:\\Tools`,
        kind: 'ExpandString',
      },
      { scope: 'user', name: 'JAVA_HOME', value: `${LINKS}\\java`, kind: 'String' },
    ])
  })

  it('is a no-op when the layout is already in place', () => {
    const vars: EnvVar[] = [
      userPath(`${LINKS}\\java\\bin;C:\\Tools`),
      { scope: 'user', name: 'JAVA_HOME', value: `${LINKS}\\java`, kind: 'String' },
    ]
    expect(managedOps(vars, managedLayout(LINKS, new Set(['java'])))).toEqual([])
  })

  it('removes its own entries and variables but not a JAVA_HOME the user set', () => {
    const layout = managedLayout(LINKS, new Set())
    const ours: EnvVar[] = [
      userPath(`${LINKS}\\java\\bin;C:\\Tools`),
      { scope: 'user', name: 'JAVA_HOME', value: `${LINKS}\\java\\`, kind: 'String' },
    ]
    expect(managedOps(ours, layout).map((op) => [op.name, op.value])).toEqual([
      ['Path', 'C:\\Tools'],
      ['JAVA_HOME', null],
    ])

    const theirs: EnvVar[] = [{ scope: 'user', name: 'JAVA_HOME', value: 'D:\\jdk', kind: 'String' }]
    expect(managedOps(theirs, layout)).toEqual([])
  })
})

describe('restoreOps', () => {
  it('sets changed values, recreates deleted ones and removes new ones', () => {
    const snapshot: EnvVar[] = [
      { scope: 'user', name: 'A', value: '1', kind: 'String' },
      { scope: 'user', name: 'B', value: '2', kind: 'String' },
      { scope: 'machine', name: 'C', value: '%X%', kind: 'ExpandString' },
    ]
    const current: EnvVar[] = [
      { scope: 'user', name: 'A', value: '1', kind: 'String' },
      { scope: 'machine', name: 'C', value: '%X%', kind: 'String' },
      { scope: 'user', name: 'D', value: '4', kind: 'String' },
    ]
    expect(restoreOps(current, snapshot).map((op) => [op.scope, op.name, op.value, op.kind])).toEqual([
      ['user', 'B', '2', 'String'],
      ['machine', 'C', '%X%', 'ExpandString'],
      ['user', 'D', null, 'String'],
    ])
  })
})
