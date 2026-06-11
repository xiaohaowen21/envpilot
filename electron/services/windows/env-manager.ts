import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  BackupRecord,
  BackupResult,
  CleanupOperation,
  CleanupPreview,
  EnvVariableEntry,
  OperationResult,
  PathIssue,
  VariableScope,
} from '../../../shared/contracts'
import { loadConfig, resolveStorageRoot } from './config-manager'
import { runPowerShell, runPowerShellJson } from './powershell'

interface BackupFilePayload {
  createdAt: string
  host: string
  variables: EnvVariableEntry[]
}

export async function getStoragePaths() {
  const config = await loadConfig()
  const rootDir = resolveStorageRoot(config)

  return {
    backupsDir: path.join(rootDir, 'backups'),
    rootDir,
  }
}

export async function getEnvironmentVariables(): Promise<EnvVariableEntry[]> {
  const script = `
$result = foreach ($scope in @('User', 'Machine')) {
  $vars = [Environment]::GetEnvironmentVariables($scope)
  foreach ($key in $vars.Keys) {
    [PSCustomObject]@{
      name = [string]$key
      value = [string]$vars[$key]
      scope = $scope.ToLower()
      source = 'registry'
    }
  }
}
@($result | Sort-Object scope, name) | ConvertTo-Json -Depth 4
`

  const output = await runPowerShellJson<EnvVariableEntry[] | EnvVariableEntry>(script)

  if (Array.isArray(output)) {
    return output
  }

  return output ? [output] : []
}

function normalizePathEntry(entry: string): string {
  return entry.trim().replace(/^"+|"+$/g, '').replace(/[\\/]+$/, '').toLowerCase()
}

function splitPathEntries(value: string): string[] {
  return value.split(';').map((item) => item.trim())
}

function expandEnvPath(entry: string): string {
  return entry.replace(/%([^%]+)%/g, (_match, name: string) => process.env[name] ?? `%${name}%`)
}

function isExistingPath(entry: string): boolean {
  const expanded = expandEnvPath(entry)
  return existsSync(expanded)
}

export function analyzePathIssues(variables: EnvVariableEntry[]): PathIssue[] {
  const issues: PathIssue[] = []
  const pathVariables = variables.filter((item) => item.name.toLowerCase() === 'path')

  for (const variable of pathVariables) {
    const seen = new Set<string>()
    const entries = splitPathEntries(variable.value)

    entries.forEach((entry, index) => {
      const normalizedEntry = normalizePathEntry(entry)
      const scope = variable.scope as VariableScope
      const id = `${scope}-${index}-${normalizedEntry || 'empty'}`

      if (!entry) {
        issues.push({
          entry,
          id,
          normalizedEntry,
          scope,
          type: 'empty',
          variable: 'Path',
        })
        return
      }

      if (entry.includes('"')) {
        issues.push({
          entry,
          id: `${id}-quoted`,
          normalizedEntry,
          scope,
          type: 'quoted',
          variable: 'Path',
        })
      }

      if (seen.has(normalizedEntry)) {
        issues.push({
          entry,
          id: `${id}-duplicate`,
          normalizedEntry,
          scope,
          type: 'duplicate',
          variable: 'Path',
        })
      } else {
        seen.add(normalizedEntry)
      }

      const checkEntry = entry.replace(/^"+|"+$/g, '')

      if (normalizedEntry && !isExistingPath(checkEntry)) {
        issues.push({
          entry,
          id: `${id}-missing`,
          normalizedEntry,
          scope,
          type: 'missing',
          variable: 'Path',
        })
      }
    })
  }

  return issues
}

export function buildCleanupPreview(pathIssues: PathIssue[]): CleanupPreview {
  const operations: CleanupOperation[] = pathIssues.map((issue) => ({
    reason:
      issue.type === 'duplicate'
        ? '重复 PATH 项，建议保留首个有效项。'
        : issue.type === 'missing'
          ? '目录不存在，建议移除。'
          : issue.type === 'quoted'
            ? '包含多余引号，建议规范化。'
            : '空 PATH 项，建议删除。',
    scope: issue.scope,
    target: issue.entry || '(空项)',
    type: issue.type,
  }))

  const removableCount = operations.filter(
    (item) => item.type === 'duplicate' || item.type === 'missing' || item.type === 'empty',
  ).length
  const fixableCount = operations.filter((item) => item.type === 'quoted').length

  return {
    fixableCount,
    generatedAt: new Date().toISOString(),
    operations,
    removableCount,
  }
}

export async function createEnvironmentBackup(): Promise<BackupResult> {
  const variables = await getEnvironmentVariables()
  const { backupsDir } = await getStoragePaths()
  const createdAt = new Date().toISOString()
  const fileName = `env-backup-${createdAt.replace(/[:.]/g, '-')}.json`
  const filePath = path.join(backupsDir, fileName)
  const payload: BackupFilePayload = {
    createdAt,
    host: process.env.COMPUTERNAME || 'unknown-host',
    variables,
  }

  await fs.mkdir(backupsDir, { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  return {
    message: '环境变量快照已生成。',
    ok: true,
    record: {
      createdAt,
      filePath,
      scopeCount: new Set(variables.map((item) => item.scope)).size,
    },
  }
}

function cleanPathValue(value: string): { changed: boolean; removedCount: number; value: string } {
  const sourceEntries = splitPathEntries(value)
  const seen = new Set<string>()
  const cleanedEntries: string[] = []
  let removedCount = 0

  for (const sourceEntry of sourceEntries) {
    const unquotedEntry = sourceEntry.trim().replace(/^"+|"+$/g, '')
    const normalizedEntry = normalizePathEntry(unquotedEntry)

    if (!normalizedEntry) {
      removedCount += 1
      continue
    }

    if (seen.has(normalizedEntry)) {
      removedCount += 1
      continue
    }

    if (!isExistingPath(unquotedEntry)) {
      removedCount += 1
      continue
    }

    seen.add(normalizedEntry)
    cleanedEntries.push(unquotedEntry)
  }

  const cleanedValue = cleanedEntries.join(';')

  return {
    changed: cleanedValue !== value,
    removedCount,
    value: cleanedValue,
  }
}

function buildPowerShellStringLiteral(value: string): string {
  if (value.length === 0) {
    return "''"
  }

  return `@'\n${value}\n'@`
}

async function setEnvironmentVariable(scope: VariableScope, name: string, value: string): Promise<void> {
  const scopeName = scope === 'user' ? 'User' : 'Machine'

  // 使用更可靠的方式设置环境变量
  const script = `
$scope = '${scopeName}'
$name = '${name}'
$value = ${buildPowerShellStringLiteral(value)}

try {
  # 设置环境变量
  [Environment]::SetEnvironmentVariable($name, $value, $scope)

  # 验证设置是否成功
  $verify = [Environment]::GetEnvironmentVariable($name, $scope)

  if ($value -and $verify -ne $value) {
    throw "Environment variable verification failed: expected '$value', got '$verify'"
  }

  Write-Output "SUCCESS: Environment variable '$name' set to '$($value.Length) characters' in $scope scope"
} catch {
  Write-Error "Failed to set environment variable: $_"
  throw
}
`

  await runPowerShell(script)

  // 同步到当前进程
  if (scope === 'user') {
    process.env[name] = value
  }
}

async function isAdministrator(): Promise<boolean> {
  return runPowerShellJson<boolean>(
    `
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) | ConvertTo-Json
`,
  )
}

async function notifyEnvironmentChanged(): Promise<void> {
  // 使用更可靠的方式广播环境变量变化
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd,
    uint Msg,
    UIntPtr wParam,
    string lParam,
    uint fuFlags,
    uint uTimeout,
    out UIntPtr lpdwResult
  );
}
"@

try {
  # 广播 WM_SETTINGCHANGE 消息到所有顶级窗口
  [UIntPtr]$result = [UIntPtr]::Zero
  $hwnd = [IntPtr]0xffff  # HWND_BROADCAST
  $msg = 0x1A             # WM_SETTINGCHANGE
  $flags = 2              # SMTO_ABORTIFHUNG
  $timeout = 5000

  # 发送消息
  $sendResult = [NativeMethods]::SendMessageTimeout(
    $hwnd,
    $msg,
    [UIntPtr]::Zero,
    'Environment',
    $flags,
    $timeout,
    [ref]$result
  )

  if ($sendResult -eq [IntPtr]::Zero) {
    Write-Warning "SendMessageTimeout returned zero, but continuing..."
  } else {
    Write-Output "SUCCESS: Environment change notification broadcast completed"
  }

  # 额外触发资源管理器刷新
  $sendResult2 = [NativeMethods]::SendMessageTimeout(
    $hwnd,
    $msg,
    [UIntPtr]::Zero,
    'Environment',
    $flags,
    $timeout,
    [ref]$result
  )

  # 等待一小段时间让系统处理消息
  Start-Sleep -Milliseconds 500
} catch {
  Write-Warning "Failed to broadcast environment change: $_"
}
`

  await runPowerShell(script)
}

export async function applyEnvironmentCleanup(): Promise<OperationResult> {
  await createEnvironmentBackup()

  const variables = await getEnvironmentVariables()
  const pathVariables = variables.filter((item) => item.name.toLowerCase() === 'path')
  const admin = await isAdministrator()
  let changedScopes = 0
  let removedEntries = 0
  let skippedMachine = false

  for (const variable of pathVariables) {
    if (variable.scope === 'machine' && !admin) {
      skippedMachine = true
      continue
    }

    const cleaned = cleanPathValue(variable.value)

    if (!cleaned.changed) {
      continue
    }

    try {
      await setEnvironmentVariable(variable.scope, variable.name, cleaned.value)
      changedScopes += 1
      removedEntries += cleaned.removedCount
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to update ${variable.scope} PATH: ${errorMsg}`)
    }
  }

  // 广播环境变量变化，确保系统识别
  await notifyEnvironmentChanged()

  // 验证写入是否成功
  const verifyVariables = await getEnvironmentVariables()
  const verifyPath = verifyVariables.find((item) => item.scope === 'user' && item.name.toLowerCase() === 'path')

  if (changedScopes > 0 && verifyPath) {
    // 验证至少用户级的PATH被更新了
    const hasChanges = pathVariables.some(v => v.scope === 'user' && v.value !== verifyPath.value)
    if (!hasChanges) {
      console.warn('Warning: PATH cleanup might not have been applied correctly')
    }
  }

  return {
    message:
      changedScopes === 0
        ? skippedMachine
          ? '未发现需要整理的用户级 PATH；系统级 PATH 因缺少管理员权限未处理。'
          : '未发现需要整理的 PATH 问题。'
        : `已整理 ${changedScopes} 个 PATH 范围，移除或修复 ${removedEntries} 个异常项${skippedMachine ? '；系统级 PATH 因缺少管理员权限未处理。' : '。'}环境变量已更新并通知系统。`,
    ok: true,
  }
}

export async function readBackupHistory(): Promise<BackupRecord[]> {
  const { backupsDir } = await getStoragePaths()

  if (!existsSync(backupsDir)) {
    return []
  }

  const files = await fs.readdir(backupsDir)
  const records = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const filePath = path.join(backupsDir, file)
        const content = await fs.readFile(filePath, 'utf8')
        const payload = JSON.parse(content) as BackupFilePayload

        return {
          createdAt: payload.createdAt,
          filePath,
          scopeCount: new Set(payload.variables.map((item) => item.scope)).size,
        }
      }),
  )

  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 50)
}

export async function deleteBackup(filePath: string): Promise<OperationResult> {
  if (!existsSync(filePath)) {
    throw new Error('备份文件不存在。')
  }

  await fs.unlink(filePath)

  return {
    message: '备份已删除。',
    ok: true,
  }
}

export async function restoreBackup(filePath: string): Promise<OperationResult> {
  if (!existsSync(filePath)) {
    throw new Error('备份文件不存在。')
  }

  const content = await fs.readFile(filePath, 'utf8')
  const payload = JSON.parse(content) as BackupFilePayload

  await createEnvironmentBackup()

  const admin = await isAdministrator()
  let restoredCount = 0

  for (const variable of payload.variables) {
    if (variable.scope === 'machine' && !admin) {
      continue
    }

    await setEnvironmentVariable(variable.scope, variable.name, variable.value)
    restoredCount++
  }

  await notifyEnvironmentChanged()

  return {
    message: `已恢复 ${restoredCount} 个环境变量。`,
    ok: true,
  }
}
