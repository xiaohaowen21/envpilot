import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import { CHANNELS, PROGRESS_EVENT, type Bridge, type Channel } from '../shared/api'
import type { InstallProgress } from '../shared/types'

const allowed = new Set<string>(CHANNELS)

const bridge: Bridge = {
  invoke: (channel: Channel, ...args: unknown[]) => {
    if (!allowed.has(channel)) return Promise.reject(new Error(`Unknown channel ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  onInstallProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: InstallProgress) => listener(progress)
    ipcRenderer.on(PROGRESS_EVENT, handler)
    return () => ipcRenderer.removeListener(PROGRESS_EVENT, handler)
  },
}

contextBridge.exposeInMainWorld('envPilot', bridge)
