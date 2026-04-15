import type { InstalledProgram, OperationResult } from '../../../shared/contracts'
import { createEnvironmentBackup } from './env-manager'
import { appendOperationLog } from './operation-log'
import { runPowerShell, runPowerShellJson } from './powershell'

function escapeForSingleQuotes(value: string): string {
  return value.replace(/'/g, "''")
}

function normalizeMsiexecCommand(command: string): string {
  let normalized = command.trim().replace(/^"|"$/g, '')
  normalized = normalized.replace(/msiexec(\.exe)?/i, 'msiexec.exe')
  normalized = normalized.replace(/\/i\b/gi, '/x')

  if (!/\/x\b/i.test(normalized)) {
    normalized = `${normalized} /x`
  }

  if (!/\/qn\b/i.test(normalized)) {
    normalized = `${normalized} /qn`
  }

  if (!/\/norestart\b/i.test(normalized)) {
    normalized = `${normalized} /norestart`
  }

  return normalized
}

export async function getInstalledRuntimePrograms(): Promise<InstalledProgram[]> {
  const script = `
$patterns = [ordered]@{
  java = '(?i)(java|jdk|jre|temurin|openjdk|oracle jdk|oracle java)'
  python = '(?i)python'
  node = '(?i)(node\\.js|nodejs)'
  go = '(?i)(golang|\\bgo\\b)'
  rust = '(?i)rust'
  php = '(?i)php'
  cpp = '(?i)(visual c\\+\\+|mingw|gcc|llvm|clang|build tools)'
}
$paths = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
$result = foreach ($path in $paths) {
  Get-ItemProperty -Path $path -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName } |
    ForEach-Object {
      $runtimeKey = $null
      foreach ($pair in $patterns.GetEnumerator()) {
        if ($_.DisplayName -match $pair.Value) {
          $runtimeKey = $pair.Key
          break
        }
      }
      if ($runtimeKey) {
        [PSCustomObject]@{
          id = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.PSPath))
          displayName = [string]$_.DisplayName
          displayVersion = [string]$_.DisplayVersion
          publisher = [string]$_.Publisher
          installLocation = [string]$_.InstallLocation
          quietUninstallCommand = [string]$_.QuietUninstallString
          runtimeKey = [string]$runtimeKey
          scope = if ($_.PSPath -like '*HKEY_CURRENT_USER*') { 'user' } else { 'machine' }
          source = 'registry'
          uninstallCommand = [string]$_.UninstallString
          canUninstall = [bool]([string]$_.QuietUninstallString -or [string]$_.UninstallString)
        }
      }
    }
}
$items = @($result | Sort-Object displayName, displayVersion -Unique)
if ($items.Count -eq 0) {
  '[]'
} else {
  $items | ConvertTo-Json -Depth 5
}
`

  const output = await runPowerShellJson<InstalledProgram[] | InstalledProgram>(script)

  if (Array.isArray(output)) {
    return output
  }

  return output ? [output] : []
}

function selectExecutionCommand(program: InstalledProgram): string {
  const quietCommand = program.quietUninstallCommand?.trim()

  if (quietCommand) {
    return quietCommand
  }

  const uninstallCommand = program.uninstallCommand?.trim()

  if (!uninstallCommand) {
    throw new Error(`未找到 ${program.displayName} 的卸载命令。`)
  }

  if (/msiexec(\.exe)?/i.test(uninstallCommand)) {
    return normalizeMsiexecCommand(uninstallCommand)
  }

  return uninstallCommand
}

export async function uninstallInstalledProgram(programId: string): Promise<OperationResult> {
  const programs = await getInstalledRuntimePrograms()
  const target = programs.find((program) => program.id === programId)

  if (!target) {
    throw new Error('未找到对应的已安装程序。')
  }

  if (!target.canUninstall) {
    throw new Error(`${target.displayName} 没有可用的卸载入口。`)
  }

  const command = selectExecutionCommand(target)

  await createEnvironmentBackup()
  await appendOperationLog({
    createdAt: new Date().toISOString(),
    level: 'info',
    message: `${target.displayName}：开始执行卸载命令。`,
  })

  try {
    await runPowerShell(
      `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${escapeForSingleQuotes(command)}' -Wait`,
    )

    await appendOperationLog({
      createdAt: new Date().toISOString(),
      level: 'info',
      message: `${target.displayName}：卸载流程执行完成。`,
    })

    return {
      message: `${target.displayName} 的卸载流程已执行完成。`,
      ok: true,
    }
  } catch (error) {
    await appendOperationLog({
      createdAt: new Date().toISOString(),
      level: 'error',
      message: `${target.displayName}：卸载失败。${error instanceof Error ? error.message : String(error)}`,
    })
    throw error
  }
}
