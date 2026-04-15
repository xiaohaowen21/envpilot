import { execFile } from 'node:child_process'
import path from 'node:path'

import type { OperationResult, SystemToolKey, SystemToolSummary } from '../../../shared/contracts'
import { getStoragePaths } from './env-manager'
import { downloadFile, type ProgressCallback } from './http-client'
import { appendOperationLog } from './operation-log'
import { runPowerShell, runPowerShellJson } from './powershell'

interface WindowsOptionalFeature {
  FeatureName: string
  State: string
}

interface DockerRegistryProgram {
  displayName: string
  quietUninstallCommand?: string
  uninstallCommand?: string
}

interface WslInfo {
  installed: boolean
  hasDistributions: boolean
  isRunning: boolean
  version?: string
}

const featureNameMap: Record<Exclude<SystemToolKey, 'docker'>, string> = {
  'hyper-v': 'Microsoft-Hyper-V-All',
  'virtual-machine-platform': 'VirtualMachinePlatform',
  wsl: 'Microsoft-Windows-Subsystem-Linux',
}

function decodeWindowsOutput(buffer: Buffer): string {
  if (buffer.includes(0)) {
    return buffer.toString('utf16le').replace(/\0/g, '').trim()
  }

  return buffer.toString('utf8').trim()
}

function execCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: 'buffer',
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const output = `${decodeWindowsOutput(stdout as Buffer)}\n${decodeWindowsOutput(stderr as Buffer)}`
          .replace(/\0/g, '')
          .trim()

        if (error) {
          reject(new Error(output || error.message))
          return
        }

        resolve(output)
      },
    )
  })
}

async function getOptionalFeatures(): Promise<WindowsOptionalFeature[]> {
  const featureNames = Object.values(featureNameMap)
  const script = `
$features = foreach ($featureName in @(${featureNames.map((featureName) => `'${featureName}'`).join(', ')})) {
  try {
    Get-WindowsOptionalFeature -Online -FeatureName $featureName -ErrorAction Stop |
      Select-Object FeatureName, State
  } catch {
    [PSCustomObject]@{
      FeatureName = $featureName
      State = 'Unknown'
    }
  }
}
@($features) | ConvertTo-Json -Depth 4
`

  const output = await runPowerShellJson<WindowsOptionalFeature[] | WindowsOptionalFeature>(script)

  if (Array.isArray(output)) {
    return output
  }

  return output ? [output] : []
}

function toToolStatus(state?: string): 'installed' | 'not_installed' | 'partial' {
  if (state === 'Enabled') {
    return 'installed'
  }

  if (state === 'Enable Pending' || state === 'Unknown') {
    return 'partial'
  }

  return 'not_installed'
}

async function getWslInfo(): Promise<WslInfo> {
  try {
    const [versionOutput, listOutput] = await Promise.all([
      execCommand('wsl.exe', ['--version']).catch(() => ''),
      execCommand('wsl.exe', ['--list', '--verbose']).catch(() => ''),
    ])

    const installed = Boolean(versionOutput || listOutput)
    const normalizedList = listOutput.replace(/\r/g, '')
    const lines = normalizedList
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^NAME\s+STATE\s+VERSION$/i.test(line))
    const hasDistributions = lines.length > 0
    const isRunning = /running/i.test(normalizedList)
    const version = versionOutput.match(/\d+(?:\.\d+){1,3}/)?.[0]

    return {
      hasDistributions,
      installed,
      isRunning,
      version,
    }
  } catch {
    return {
      hasDistributions: false,
      installed: false,
      isRunning: false,
    }
  }
}

async function getDockerProgram(): Promise<DockerRegistryProgram | null> {
  const script = `
$paths = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
$item = $null
foreach ($path in $paths) {
  $item = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match '(?i)docker desktop' } |
    Select-Object -First 1 DisplayName, QuietUninstallString, UninstallString
  if ($item) { break }
}
if (-not $item) { 'null' } else { $item | ConvertTo-Json -Depth 4 }
`

  const raw = await runPowerShell(script)

  if (raw === 'null') {
    return null
  }

  const parsed = JSON.parse(raw) as {
    DisplayName: string
    QuietUninstallString?: string
    UninstallString?: string
  }

  return {
    displayName: parsed.DisplayName,
    quietUninstallCommand: parsed.QuietUninstallString,
    uninstallCommand: parsed.UninstallString,
  }
}

async function getDockerVersion(): Promise<string | undefined> {
  try {
    const output = await execCommand('docker.exe', ['--version'])
    return output.match(/\d+(?:\.\d+){1,3}/)?.[0]
  } catch {
    return undefined
  }
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

async function runCommandThroughCmd(command: string): Promise<void> {
  const escaped = command.replace(/'/g, "''")
  await runPowerShell(`Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${escaped}' -Wait`)
}

export async function getSystemToolSummaries(): Promise<SystemToolSummary[]> {
  const [features, dockerProgram, dockerVersion, wslInfo] = await Promise.all([
    getOptionalFeatures(),
    getDockerProgram(),
    getDockerVersion(),
    getWslInfo(),
  ])
  const featureState = new Map(features.map((feature) => [feature.FeatureName, feature.State]))
  const vmpState =
    wslInfo.installed && wslInfo.hasDistributions ? 'Enabled' : featureState.get(featureNameMap['virtual-machine-platform'])
  const wslStatus = wslInfo.installed ? 'installed' : toToolStatus(featureState.get(featureNameMap.wsl))
  const wslNotes = wslInfo.installed
    ? wslInfo.isRunning
      ? '已安装，当前至少有一个发行版正在运行。'
      : '已安装，但当前发行版未启动。'
    : featureState.get(featureNameMap.wsl) === 'Unknown'
      ? '当前未提权读取系统功能，状态可能不完整。'
      : '未检测到可用的 WSL。'

  return [
    {
      category: 'virtualization',
      description: 'Windows Subsystem for Linux，可用于 WSL2、容器和开发工具链。',
      key: 'wsl',
      label: 'WSL',
      notes: wslNotes,
      status: wslStatus,
      version: wslInfo.version,
    },
    {
      category: 'virtualization',
      description: 'WSL2 和 Docker Desktop 常见依赖组件。',
      key: 'virtual-machine-platform',
      label: 'Virtual Machine Platform',
      notes:
        vmpState === 'Enabled'
          ? '已启用。'
          : vmpState === 'Unknown'
            ? '当前未提权读取系统功能，状态可能不完整。'
            : '未启用，启用后通常需要重启系统。',
      status: toToolStatus(vmpState),
    },
    {
      category: 'virtualization',
      description: '适合 Hyper-V 虚拟机、容器隔离和企业场景。',
      key: 'hyper-v',
      label: 'Hyper-V',
      notes:
        featureState.get(featureNameMap['hyper-v']) === 'Enabled'
          ? '已启用。'
          : featureState.get(featureNameMap['hyper-v']) === 'Unknown'
            ? '当前未提权读取系统功能，状态可能不完整。'
            : '未启用；部分系统版本可能不支持。',
      status: toToolStatus(featureState.get(featureNameMap['hyper-v'])),
    },
    {
      category: 'container',
      description: 'Docker Desktop 官方桌面版，可配合 WSL2 或 Hyper-V 使用。',
      key: 'docker',
      label: 'Docker Desktop',
      notes: dockerProgram ? '已检测到安装记录。' : '尚未检测到 Docker Desktop 的安装记录。',
      status: dockerProgram ? 'installed' : 'not_installed',
      version: dockerVersion,
    },
  ]
}

async function toggleOptionalFeature(
  tool: Exclude<SystemToolKey, 'docker'>,
  enable: boolean,
): Promise<OperationResult> {
  const action = enable ? 'Enable' : 'Disable'
  const featureName = featureNameMap[tool]
  const command = enable
    ? `${action}-WindowsOptionalFeature -Online -FeatureName '${featureName}' -All -NoRestart`
    : `${action}-WindowsOptionalFeature -Online -FeatureName '${featureName}' -NoRestart`
  await appendOperationLog({
    createdAt: new Date().toISOString(),
    level: 'info',
    message: `${featureName}：开始${enable ? '启用' : '关闭'}。`,
  })
  await runPowerShell(command)

  return {
    message: `${featureName} 已${enable ? '启用' : '关闭'}，如系统提示请手动重启。`,
    ok: true,
  }
}

export async function installSystemTool(
  tool: SystemToolKey,
  onProgress?: ProgressCallback,
): Promise<OperationResult> {
  if (tool !== 'docker') {
    return toggleOptionalFeature(tool, true)
  }

  const { rootDir } = await getStoragePaths()
  const installerPath = path.join(rootDir, 'downloads', 'docker', 'DockerDesktopInstaller.exe')
  const downloadUrl = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'

  await appendOperationLog({
    createdAt: new Date().toISOString(),
    level: 'info',
    message: 'Docker Desktop：开始下载安装程序。',
  })

  await downloadFile(downloadUrl, installerPath, onProgress)
  await runPowerShell(
    `Start-Process -FilePath @'\n${installerPath}\n'@ -ArgumentList 'install', '--quiet' -Verb RunAs -Wait`,
  )

  return {
    message: 'Docker Desktop 安装命令已执行，完成后建议重新打开程序确认状态。',
    ok: true,
  }
}

export async function uninstallSystemTool(tool: SystemToolKey): Promise<OperationResult> {
  if (tool !== 'docker') {
    return toggleOptionalFeature(tool, false)
  }

  const dockerProgram = await getDockerProgram()

  if (!dockerProgram) {
    throw new Error('未检测到 Docker Desktop 安装记录。')
  }

  const command =
    dockerProgram.quietUninstallCommand ||
    (dockerProgram.uninstallCommand?.match(/msiexec/i)
      ? normalizeMsiexecCommand(dockerProgram.uninstallCommand)
      : dockerProgram.uninstallCommand)

  if (!command) {
    throw new Error('未找到 Docker Desktop 的卸载命令。')
  }

  await runCommandThroughCmd(command)

  return {
    message: 'Docker Desktop 卸载命令已执行完成。',
    ok: true,
  }
}
