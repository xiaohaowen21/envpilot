import { execFile } from 'node:child_process'

import type { RuntimeKey, RuntimeSummary } from '../../../shared/contracts'

interface RuntimeProbe {
  key: RuntimeKey
  label: string
  command: string
  args: string[]
  recommendedVersion: string
}

const probes: RuntimeProbe[] = [
  {
    args: ['-version'],
    command: 'java',
    key: 'java',
    label: 'Java',
    recommendedVersion: '21 LTS',
  },
  {
    args: ['--version'],
    command: 'python',
    key: 'python',
    label: 'Python',
    recommendedVersion: '3.13',
  },
  {
    args: ['-v'],
    command: 'node',
    key: 'node',
    label: 'Node.js',
    recommendedVersion: '24 LTS',
  },
  {
    args: ['version'],
    command: 'go',
    key: 'go',
    label: 'Go',
    recommendedVersion: '1.24',
  },
  {
    args: ['-V'],
    command: 'rustc',
    key: 'rust',
    label: 'Rust',
    recommendedVersion: 'stable',
  },
  {
    args: ['-v'],
    command: 'php',
    key: 'php',
    label: 'PHP',
    recommendedVersion: '8.3',
  },
  {
    args: ['--version'],
    command: 'gcc',
    key: 'cpp',
    label: 'C/C++',
    recommendedVersion: 'MSVC Build Tools / MinGW',
  },
]

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error)
          return
        }

        resolve(`${stdout}\n${stderr}`.trim())
      },
    )
  })
}

function extractVersion(output: string): string | undefined {
  const quotedMatch = output.match(/"([^"]+)"/)

  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const versionMatch = output.match(/v?\d+(?:\.\d+){1,3}/i)

  return versionMatch?.[0]
}

async function detectRuntime(probe: RuntimeProbe): Promise<RuntimeSummary> {
  try {
    const output = await runCommand(probe.command, probe.args)
    const version = extractVersion(output)

    return {
      command: probe.command,
      detected: true,
      key: probe.key,
      label: probe.label,
      recommendedVersion: probe.recommendedVersion,
      status: version ? 'ready' : 'warning',
      version,
      notes: version ? undefined : '已检测到命令，但版本输出无法解析。',
    }
  } catch {
    return {
      command: probe.command,
      detected: false,
      key: probe.key,
      label: probe.label,
      recommendedVersion: probe.recommendedVersion,
      status: 'missing',
      notes: '尚未在当前系统 PATH 中发现该运行时。',
    }
  }
}

export async function detectRuntimes(): Promise<RuntimeSummary[]> {
  return Promise.all(probes.map((probe) => detectRuntime(probe)))
}
