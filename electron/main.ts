// @wen — EnvPilot main process
import path from 'node:path'

import { BrowserWindow, Menu, app, shell } from 'electron'

import { registerIpc } from './ipc'

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'EnvPilot',
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  window.once('ready-to-show', () => window.show())

  // Links open in the browser; the app window never navigates away.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  if (DEV_SERVER_URL) void window.loadURL(DEV_SERVER_URL)
  else void window.loadFile(path.join(__dirname, '../dist/index.html'))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (window?.isMinimized()) window.restore()
    window?.focus()
  })

  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    registerIpc()
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
