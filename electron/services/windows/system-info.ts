import os from 'node:os'

import type { SystemSummary } from '../../../shared/contracts'
import { runPowerShell } from './powershell'

async function detectAdmin(): Promise<boolean> {
  const script = `
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
`

  return (await runPowerShell(script)).toLowerCase() === 'true'
}

async function detectNetwork(): Promise<boolean> {
  const script = 'Test-Connection -ComputerName 1.1.1.1 -Count 1 -Quiet'

  try {
    return (await runPowerShell(script)).toLowerCase() === 'true'
  } catch {
    return false
  }
}

export async function getSystemSummary(): Promise<SystemSummary> {
  const [isAdmin, hasNetwork] = await Promise.all([detectAdmin(), detectNetwork()])

  return {
    architecture: os.arch(),
    hasNetwork,
    isAdmin,
    platform: 'Windows',
    release: os.release(),
    shell: 'PowerShell',
  }
}
