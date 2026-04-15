import path from 'node:path'

import { BrowserWindow, Menu, Notification, Tray, app, globalShortcut, ipcMain, nativeImage } from 'electron'

import type { DashboardData, DownloadProgress, InstallRuntimeOptions, ManagedRuntimeKey } from '../shared/contracts'
import {
  analyzePathIssues,
  applyEnvironmentCleanup,
  buildCleanupPreview,
  createEnvironmentBackup,
  deleteBackup,
  getEnvironmentVariables,
  getStoragePaths,
  readBackupHistory,
  restoreBackup,
} from './services/windows/env-manager'
import {
  getInstalledRuntimePrograms,
  uninstallInstalledProgram,
} from './services/windows/installed-programs'
import { loadConfig, saveConfig, exportConfig, importConfig } from './services/windows/config-manager'
import { appendOperationLog, clearOperationLogs, readRecentOperationLogs } from './services/windows/operation-log'
import { detectRuntimes } from './services/windows/runtime-detector'
import {
  getManagedRuntimeSummaries,
  installManagedRuntime,
  switchManagedRuntime,
  uninstallManagedRuntime,
} from './services/windows/runtime-installer'
import { getSystemSummary } from './services/windows/system-info'
import {
  getSystemToolSummaries,
  installSystemTool,
  uninstallSystemTool,
} from './services/windows/system-tools'
import { runDiagnostics } from './services/windows/diagnostics'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function sendDownloadProgress(progress: DownloadProgress): void {
  mainWindow?.webContents.send('download:progress', progress)
}

async function buildDashboard(): Promise<DashboardData> {
  const variables = await getEnvironmentVariables()
  const pathIssues = analyzePathIssues(variables)
  const [system, runtimes, backupHistory, operationLogs, installedPrograms, systemTools] =
    await Promise.all([
      getSystemSummary(),
      detectRuntimes(),
      readBackupHistory(),
      readRecentOperationLogs(),
      getInstalledRuntimePrograms(),
      getSystemToolSummaries(),
    ])
  const managedRuntimes = await getManagedRuntimeSummaries()
  const { backupsDir, rootDir } = await getStoragePaths()

  return {
    backupHistory,
    backupsDir,
    generatedAt: new Date().toISOString(),
    installedPrograms,
    managedRuntimes,
    operationLogs,
    pathIssues,
    productName: 'EnvPilot Windows MVP',
    rootDir,
    runtimes,
    system,
    systemTools,
    variables,
  }
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    height: 920,
    minHeight: 780,
    minWidth: 1200,
    show: false,
    title: 'EnvPilot Windows MVP',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    width: 1480,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADhSURBVDiNpZMxDoMwDEV/iDeBhTfYeQNeoO4duHRgxw1YWVi6MXHjBjN0YGLqwsCdJYQ8kKhIlaqmf8mW/ee/YxOIqgC+gANwBHYR8Wu9T+AdOAM7EXG5AFIqWQDvwBE4iIi7BJBSiYi4A0fgCOwi4pL38FU9A4/ABTiJSJwEkFKJiLgBZ2AvInEeQEolIuIOnIGDiMRZACmViIg7cAEOIhLnAaRUIiLuwBU4iEicB5BSiYi4A1fgICJxHkBKJSLiDlyBg4jEeQDN+gQeIuKmADTrE3iKiJ8C0KxP4CUifgJAs76Al+bn+gZ9cZ8JbFF+LgAAAABJRU5ErkJggg=='
  )

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 EnvPilot',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '创建备份',
      click: async () => {
        try {
          await createEnvironmentBackup()
          mainWindow?.webContents.send('backup:completed')
        } catch (error) {
          console.error('Backup failed:', error)
        }
      },
    },
    {
      label: '清理环境变量',
      click: async () => {
        try {
          await applyEnvironmentCleanup()
          mainWindow?.webContents.send('cleanup:completed')
        } catch (error) {
          console.error('Cleanup failed:', error)
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setToolTip('EnvPilot - 环境自动化工具')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function registerIpcHandlers() {
  ipcMain.handle('dashboard:get', async () => buildDashboard())
  ipcMain.handle('backup:create', async () => createEnvironmentBackup())
  ipcMain.handle('cleanup:preview', async () => {
    const variables = await getEnvironmentVariables()
    const pathIssues = analyzePathIssues(variables)

    return buildCleanupPreview(pathIssues)
  })
  ipcMain.handle(
    'runtime:install',
    async (_event, runtime: ManagedRuntimeKey, options?: InstallRuntimeOptions) =>
      installManagedRuntime(runtime, options, sendDownloadProgress),
  )
  ipcMain.handle('runtime:switch', async (_event, runtime: ManagedRuntimeKey, runtimeId: string) =>
    switchManagedRuntime(runtime, runtimeId),
  )
  ipcMain.handle(
    'runtime:uninstall',
    async (_event, runtime: ManagedRuntimeKey, runtimeId: string) =>
      uninstallManagedRuntime(runtime, runtimeId),
  )
  ipcMain.handle('program:uninstall', async (_event, programId: string) =>
    uninstallInstalledProgram(programId),
  )
  ipcMain.handle('system-tool:install', async (_event, tool) =>
    installSystemTool(tool, sendDownloadProgress),
  )
  ipcMain.handle('system-tool:uninstall', async (_event, tool) => uninstallSystemTool(tool))
  ipcMain.handle('cleanup:apply', async () => {
    try {
      const result = await applyEnvironmentCleanup()
      await appendOperationLog({
        createdAt: new Date().toISOString(),
        level: 'info',
        message: `Environment cleanup finished: ${result.message}`,
      })
      return result
    } catch (error) {
      await appendOperationLog({
        createdAt: new Date().toISOString(),
        level: 'error',
        message: `Environment cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      })
      throw error
    }
  })
  ipcMain.handle('config:get', async () => loadConfig())
  ipcMain.handle('config:save', async (_event, config) => saveConfig(config))
  ipcMain.handle('logs:get', async (_event, limit) => readRecentOperationLogs(limit))
  ipcMain.handle('logs:clear', async () => clearOperationLogs())
  ipcMain.handle('backups:get', async () => readBackupHistory())
  ipcMain.handle('backup:delete', async (_event, filePath) => deleteBackup(filePath))
  ipcMain.handle('backup:restore', async (_event, filePath) => restoreBackup(filePath))
  ipcMain.handle('diagnostics:run', async () => runDiagnostics())
  ipcMain.handle('notification:show', async (_event, title: string, body: string) => {
    new Notification({ title, body }).show()
  })
  ipcMain.handle('config:export', async () => exportConfig())
  ipcMain.handle('config:import', async (_event, data) => importConfig(data))
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  await createMainWindow()
  createTray()

  globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  globalShortcut.register('CommandOrControl+Shift+B', async () => {
    try {
      await createEnvironmentBackup()
      mainWindow?.webContents.send('backup:completed')
      new Notification({
        title: 'EnvPilot',
        body: '备份已创建',
      }).show()
    } catch (error) {
      console.error('Backup failed:', error)
    }
  })

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()

  if (tray) {
    tray.destroy()
    tray = null
  }
})
