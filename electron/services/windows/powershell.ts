import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

function resolvePowerShellPath(): string {
  const windowsRoots = [process.env.SystemRoot, process.env.WINDIR, 'C:\\Windows'].filter(
    (value): value is string => Boolean(value),
  )

  const candidates = windowsRoots.flatMap((root) => [
    path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.win32.join(root, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ])

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return 'powershell.exe'
}

const POWERSHELL_PATH = resolvePowerShellPath()

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, '').trim()
}

export function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL_PATH,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script,
      ],
      {
        maxBuffer: 1024 * 1024 * 10,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stripBom(stderr || error.message)))
          return
        }

        resolve(stripBom(stdout))
      },
    )
  })
}

export async function runPowerShellJson<T>(script: string): Promise<T> {
  const output = await runPowerShell(script)

  if (!output) {
    throw new Error('PowerShell 未返回数据。')
  }

  return JSON.parse(output) as T
}
