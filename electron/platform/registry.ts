import type { EnvVar } from '../../shared/types'
import type { EnvOp } from '../core/plan'
import { runScript } from './powershell'

/**
 * Environment variables live in two registry keys. Values are read and written
 * raw (no %VAR% expansion) and keep their REG_SZ / REG_EXPAND_SZ kind, which
 * [Environment]::SetEnvironmentVariable does not guarantee.
 */
const OPEN_KEY = `
function Open-EnvKey([string]$scope, [bool]$writable) {
  if ($scope -eq 'machine') {
    return [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', $writable)
  }
  return [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
}`

const READ = `${OPEN_KEY}
$vars = foreach ($scope in @('user', 'machine')) {
  $key = Open-EnvKey $scope $false
  foreach ($name in $key.GetValueNames()) {
    if (-not $name) { continue }
    $kind = $key.GetValueKind($name).ToString()
    if ($kind -ne 'String' -and $kind -ne 'ExpandString') { continue }
    @{
      scope = $scope
      name = $name
      value = [string]$key.GetValue($name, '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
      kind = $kind
    }
  }
  $key.Close()
}
@{ vars = @($vars) }`

// Tells Explorer and other top-level windows to reload the environment, so new terminals see the change.
const BROADCAST = `
Add-Type -Namespace EnvPilot -Name Native -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)]
public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, UIntPtr wParam, string lParam, uint flags, uint timeout, out UIntPtr result);
'@
$ignored = [UIntPtr]::Zero
[void][EnvPilot.Native]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 3000, [ref]$ignored)`

const WRITE = `${OPEN_KEY}
foreach ($op in @($Payload)) {
  $key = Open-EnvKey $op.scope $true
  if ($null -eq $op.value) {
    $key.DeleteValue($op.name, $false)
  } else {
    $kind = [Enum]::Parse([Microsoft.Win32.RegistryValueKind], $op.kind)
    $key.SetValue($op.name, [string]$op.value, $kind)
  }
  $key.Close()
}
${BROADCAST}
@{ written = @($Payload).Count }`

export async function readEnvironment(): Promise<EnvVar[]> {
  const { vars } = await runScript<{ vars: EnvVar[] }>(READ)
  return vars
}

export function needsElevation(ops: readonly EnvOp[]): boolean {
  return ops.some((op) => op.scope === 'machine')
}

/** Applies all operations in one PowerShell run; prompts for elevation if any touch machine scope. */
export async function writeEnvironment(ops: readonly EnvOp[]): Promise<void> {
  if (ops.length === 0) return
  await runScript(WRITE, { input: ops, elevated: needsElevation(ops) })
}
