import path from 'node:path'

import { RUNTIME_KEYS, type RuntimeKey } from '../../shared/types'
import type { ManagedLayout } from './plan'

/**
 * How each runtime is exposed. Every runtime gets one junction,
 * `<storage>\links\<key>`, pointing at the active version; PATH and variables
 * only ever reference the junction, so switching versions never rewrites them.
 */
export interface RuntimeDefinition {
  executable: string
  versionArgs: string[]
  /** Directories under the junction that go on PATH. */
  pathDirs: string[]
  /** Variables pointing under the junction ('' is the junction itself). */
  variables: Record<string, string>
  /** Directory inside an installed version that the junction targets. */
  linkTarget: string
}

export const RUNTIMES: Record<RuntimeKey, RuntimeDefinition> = {
  java: { executable: 'java.exe', versionArgs: ['-version'], pathDirs: ['bin'], variables: { JAVA_HOME: '' }, linkTarget: '' },
  node: { executable: 'node.exe', versionArgs: ['-v'], pathDirs: [''], variables: {}, linkTarget: '' },
  // The NuGet distribution of CPython keeps the interpreter under tools\.
  python: { executable: 'python.exe', versionArgs: ['--version'], pathDirs: ['', 'Scripts'], variables: {}, linkTarget: 'tools' },
  go: { executable: 'go.exe', versionArgs: ['version'], pathDirs: ['bin'], variables: {}, linkTarget: '' },
  rust: {
    executable: 'rustc.exe',
    versionArgs: ['-V'],
    pathDirs: ['cargo\\bin'],
    variables: { CARGO_HOME: 'cargo', RUSTUP_HOME: 'rustup' },
    linkTarget: '',
  },
  php: { executable: 'php.exe', versionArgs: ['-v'], pathDirs: [''], variables: {}, linkTarget: '' },
}

export function linkPath(linksRoot: string, runtime: RuntimeKey): string {
  return path.win32.join(linksRoot, runtime)
}

export function managedPathDirs(linksRoot: string, runtime: RuntimeKey): string[] {
  return RUNTIMES[runtime].pathDirs.map((dir) => path.win32.join(linkPath(linksRoot, runtime), dir))
}

export function managedLayout(linksRoot: string, enabled: ReadonlySet<RuntimeKey>): ManagedLayout {
  return {
    pathDirs: RUNTIME_KEYS.filter((key) => enabled.has(key)).flatMap((key) => managedPathDirs(linksRoot, key)),
    knownPathDirs: RUNTIME_KEYS.flatMap((key) => managedPathDirs(linksRoot, key)),
    variables: RUNTIME_KEYS.flatMap((key) =>
      Object.entries(RUNTIMES[key].variables).map(([name, dir]) => {
        const owned = path.win32.join(linkPath(linksRoot, key), dir)
        return { name, owned, value: enabled.has(key) ? owned : null }
      }),
    ),
  }
}
