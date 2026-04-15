import type { ElectronApi } from '../shared/contracts'

declare global {
  interface Window {
    envPilot: ElectronApi
  }
}

export {}
