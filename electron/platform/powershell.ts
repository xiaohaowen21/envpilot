import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { AppError } from '../../shared/errors'

/**
 * Runs PowerShell scripts through temporary files instead of the command line.
 * Input and output travel as UTF-8 JSON files, which avoids console code-page
 * garbling, quoting bugs and command-line length limits, and lets the same
 * script run elevated through a UAC prompt when it must touch machine scope.
 */

const POWERSHELL = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const BASE_ARGS = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File']
const DECLINED_EXIT_CODE = 3

const wrap = (body: string) => `param([string]$InputPath, [string]$OutputPath)
$ErrorActionPreference = 'Stop'
function Write-Result($value) {
  $json = ConvertTo-Json -InputObject $value -Depth 8 -Compress
  [IO.File]::WriteAllText($OutputPath, $json, [Text.UTF8Encoding]::new($false))
}
try {
  $Payload = [IO.File]::ReadAllText($InputPath) | ConvertFrom-Json
  $result = & {
${body}
  }
  Write-Result @{ ok = $true; data = $result }
} catch {
  Write-Result @{ ok = $false; error = $_.Exception.Message }
}
`

const LAUNCHER = `param([string]$Target, [string]$InputPath, [string]$OutputPath)
$arguments = @('${BASE_ARGS.join("','")}', "\`"$Target\`"", '-InputPath', "\`"$InputPath\`"", '-OutputPath', "\`"$OutputPath\`"")
try {
  $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList $arguments
} catch {
  exit ${DECLINED_EXIT_CODE}
}
exit $process.ExitCode
`

function exec(file: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error) => {
      if (error && typeof error.code !== 'number') reject(error)
      else resolve(typeof error?.code === 'number' ? error.code : 0)
    })
  })
}

export interface ScriptOptions {
  input?: unknown
  /** Run through a UAC prompt; required for machine-scope registry writes. */
  elevated?: boolean
}

export async function runScript<T>(body: string, { input = null, elevated = false }: ScriptOptions = {}): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'envpilot-'))
  const scriptPath = path.join(dir, 'script.ps1')
  const inputPath = path.join(dir, 'input.json')
  const outputPath = path.join(dir, 'output.json')

  try {
    // The BOM makes Windows PowerShell 5.1 read the script as UTF-8.
    await fs.writeFile(scriptPath, `\uFEFF${wrap(body)}`, 'utf8')
    await fs.writeFile(inputPath, JSON.stringify(input), 'utf8')
    const params = ['-InputPath', inputPath, '-OutputPath', outputPath]

    if (elevated) {
      const launcherPath = path.join(dir, `launch-${randomUUID()}.ps1`)
      await fs.writeFile(launcherPath, LAUNCHER, 'utf8')
      const code = await exec(POWERSHELL, [...BASE_ARGS, launcherPath, '-Target', scriptPath, ...params])
      if (code === DECLINED_EXIT_CODE) throw new AppError('elevation_declined')
    } else {
      await exec(POWERSHELL, [...BASE_ARGS, scriptPath, ...params])
    }

    const output = await fs.readFile(outputPath, 'utf8').catch(() => '')
    if (!output) throw new AppError('unknown', { message: 'PowerShell produced no result.' })

    const result = JSON.parse(output.replace(/^\uFEFF/, '')) as { ok: boolean; data: T; error?: string }
    if (!result.ok) throw new AppError('unknown', { message: result.error ?? 'PowerShell failed.' })
    return result.data
  } finally {
    // Files written by an elevated run may resist deletion; a leftover temp folder is harmless.
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
