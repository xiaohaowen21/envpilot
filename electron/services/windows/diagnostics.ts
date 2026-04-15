import { existsSync } from 'node:fs'
import os from 'node:os'

import type { DiagnosticItem, DiagnosticResult } from '../../../shared/contracts'
import { getEnvironmentVariables, getStoragePaths } from './env-manager'
import { detectRuntimes } from './runtime-detector'

async function checkSystemInfo(): Promise<DiagnosticItem[]> {
  const items: DiagnosticItem[] = []

  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()
  const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100

  if (memoryUsagePercent > 90) {
    items.push({
      message: `内存使用率过高: ${memoryUsagePercent.toFixed(1)}%`,
      severity: 'warning',
      suggestion: '建议关闭不必要的程序以释放内存。',
    })
  }

  const cpus = os.cpus()
  if (cpus.length < 4) {
    items.push({
      message: `CPU 核心数较少: ${cpus.length} 核`,
      severity: 'info',
      suggestion: '多核 CPU 可以提升编译和构建速度。',
    })
  }

  const platform = os.platform()
  const release = os.release()
  items.push({
    message: `操作系统: ${platform} ${release}`,
    severity: 'info',
  })

  return items
}

async function checkStoragePaths(): Promise<DiagnosticItem[]> {
  const items: DiagnosticItem[] = []
  const { rootDir, backupsDir } = await getStoragePaths()

  if (!existsSync(rootDir)) {
    items.push({
      message: `工作目录不存在: ${rootDir}`,
      severity: 'warning',
      suggestion: 'EnvPilot 将在首次使用时自动创建该目录。',
    })
  }

  if (!existsSync(backupsDir)) {
    items.push({
      message: '备份目录不存在',
      severity: 'info',
      suggestion: '首次创建备份时将自动创建该目录。',
    })
  }

  if (rootDir.startsWith('D:')) {
    if (!existsSync('D:\\')) {
      items.push({
        message: 'D 盘不存在，但配置为使用 D 盘存储',
        severity: 'error',
        suggestion: '请在设置中更改存储路径，或确保 D 盘可用。',
      })
    }
  }

  return items
}

async function checkEnvironmentVariables(): Promise<DiagnosticItem[]> {
  const items: DiagnosticItem[] = []
  const variables = await getEnvironmentVariables()

  const pathVar = variables.find((v) => v.name.toLowerCase() === 'path')
  if (pathVar) {
    const entries = pathVar.value.split(';').filter(Boolean)
    const duplicates = entries.filter((entry, index) => entries.indexOf(entry) !== index)

    if (duplicates.length > 0) {
      items.push({
        message: `PATH 变量包含 ${duplicates.length} 个重复项`,
        severity: 'warning',
        suggestion: '可以使用"变量治理"功能清理重复项。',
      })
    }

    const emptyCount = entries.filter((e) => !e.trim()).length
    if (emptyCount > 0) {
      items.push({
        message: `PATH 变量包含 ${emptyCount} 个空项`,
        severity: 'warning',
        suggestion: '可以使用"变量治理"功能清理空项。',
      })
    }
  }

  const importantVars = ['JAVA_HOME', 'PYTHON_HOME', 'NODE_HOME', 'GOROOT']
  for (const varName of importantVars) {
    const variable = variables.find((v) => v.name === varName)
    if (variable && !existsSync(variable.value)) {
      items.push({
        message: `${varName} 指向不存在的路径: ${variable.value}`,
        severity: 'warning',
        suggestion: `请更新 ${varName} 环境变量或删除无效值。`,
      })
    }
  }

  return items
}

async function checkRuntimes(): Promise<DiagnosticItem[]> {
  const items: DiagnosticItem[] = []
  const runtimes = await detectRuntimes()

  for (const runtime of runtimes) {
    if (runtime.detected) {
      items.push({
        message: `${runtime.label}: ${runtime.version || '已检测到'}`,
        severity: 'info',
      })
    } else {
      items.push({
        message: `${runtime.label}: 未检测到`,
        severity: 'info',
        suggestion: `如果需要 ${runtime.label}，可以在"多版本运行时"工作区安装。`,
      })
    }
  }

  return items
}

async function checkNetwork(): Promise<DiagnosticItem[]> {
  const items: DiagnosticItem[] = []

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    await fetch('https://www.google.com', {
      method: 'HEAD',
      signal: controller.signal,
    })

    clearTimeout(timeout)
    items.push({
      message: '网络连接正常',
      severity: 'info',
    })
  } catch {
    items.push({
      message: '无法访问外网',
      severity: 'warning',
      suggestion: '下载运行时和软件需要网络连接。',
    })
  }

  return items
}

export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const [systemInfo, storagePaths, environmentVariables, runtimes, network] = await Promise.all([
    checkSystemInfo(),
    checkStoragePaths(),
    checkEnvironmentVariables(),
    checkRuntimes(),
    checkNetwork(),
  ])

  return [
    {
      category: 'system',
      items: systemInfo,
    },
    {
      category: 'storage',
      items: storagePaths,
    },
    {
      category: 'environment',
      items: environmentVariables,
    },
    {
      category: 'runtimes',
      items: runtimes,
    },
    {
      category: 'network',
      items: network,
    },
  ]
}
