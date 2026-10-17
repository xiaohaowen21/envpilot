import type { JavaVendor, RuntimeKey } from '../shared/types'

export const RUNTIME_NAMES: Record<RuntimeKey, string> = {
  java: 'Java',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
}

/** Two-letter marks for the coloured tiles. */
export const RUNTIME_MARKS: Record<RuntimeKey, string> = {
  java: 'Jv',
  node: 'Nd',
  python: 'Py',
  go: 'Go',
  rust: 'Rs',
  php: 'Ph',
}

export const VENDOR_NAMES: Record<JavaVendor, string> = {
  temurin: 'Eclipse Temurin',
  microsoft: 'Microsoft OpenJDK',
  oracle: 'Oracle JDK',
}
