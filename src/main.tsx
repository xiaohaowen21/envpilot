// @wen
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import './styles.css'

async function start() {
  // Outside Electron (plain `vite` in a browser), fall back to sample data so the UI can be worked on anywhere.
  if (import.meta.env.DEV && !window.envPilot) {
    const { installDevBridge } = await import('./dev/dev-bridge')
    installDevBridge()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
