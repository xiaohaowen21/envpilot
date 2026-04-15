import { contextBridge, ipcRenderer } from 'electron'

import type { DownloadProgress, ElectronApi } from '../shared/contracts'

const api: ElectronApi = {
  applyCleanup: () => ipcRenderer.invoke('cleanup:apply'),
  clearOperationLogs: () => ipcRenderer.invoke('logs:clear'),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  deleteBackup: (filePath) => ipcRenderer.invoke('backup:delete', filePath),
  exportConfig: () => ipcRenderer.invoke('config:export'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  getBackups: () => ipcRenderer.invoke('backups:get'),
  getOperationLogs: (limit) => ipcRenderer.invoke('logs:get', limit),
  importConfig: (data) => ipcRenderer.invoke('config:import', data),
  installRuntime: (runtime, options) => ipcRenderer.invoke('runtime:install', runtime, options),
  installSystemTool: (tool) => ipcRenderer.invoke('system-tool:install', tool),
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => {
      callback(progress)
    }

    ipcRenderer.on('download:progress', handler)

    return () => {
      ipcRenderer.removeListener('download:progress', handler)
    }
  },
  previewCleanup: () => ipcRenderer.invoke('cleanup:preview'),
  restoreBackup: (filePath) => ipcRenderer.invoke('backup:restore', filePath),
  runDiagnostics: () => ipcRenderer.invoke('diagnostics:run'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', title, body),
  switchRuntime: (runtime, runtimeId) => ipcRenderer.invoke('runtime:switch', runtime, runtimeId),
  uninstallSystemTool: (tool) => ipcRenderer.invoke('system-tool:uninstall', tool),
  uninstallProgram: (programId) => ipcRenderer.invoke('program:uninstall', programId),
  uninstallRuntime: (runtime, runtimeId) =>
    ipcRenderer.invoke('runtime:uninstall', runtime, runtimeId),
}

contextBridge.exposeInMainWorld('envPilot', api)
