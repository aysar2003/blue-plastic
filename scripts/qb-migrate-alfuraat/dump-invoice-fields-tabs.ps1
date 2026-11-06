# After Create Invoices has an invoice open, dump clipboard value of many Tab stops.
param([string]$Number = '0970')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win2 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

$p = Get-Process QBW32 | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if (-not $p) { throw 'QBW32 not found' }
$hwnd = $p.MainWindowHandle
if ([Win2]::IsIconic($hwnd)) { [Win2]::ShowWindow($hwnd, 9) | Out-Null }
[Win2]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 800

[System.Windows.Forms.SendKeys]::SendWait('^f')
Start-Sleep -Milliseconds 800
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait($Number)
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 1500

# Escape Find dialog if still open, ensure invoice form focused
[System.Windows.Forms.SendKeys]::SendWait('{ESC}')
Start-Sleep -Milliseconds 400
[Win2]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 300

# Jump to top: Ctrl+Home sometimes works; else click isn't available — use Shift+Tab many times then Tab dump
for ($i = 0; $i -lt 25; $i++) { [System.Windows.Forms.SendKeys]::SendWait('+{TAB}'); Start-Sleep -Milliseconds 40 }
Start-Sleep -Milliseconds 200

$vals = @()
for ($i = 0; $i -lt 30; $i++) {
  [System.Windows.Forms.Clipboard]::Clear()
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 60
  [System.Windows.Forms.SendKeys]::SendWait('^c')
  Start-Sleep -Milliseconds 100
  $t = ''
  try { $t = [System.Windows.Forms.Clipboard]::GetText() } catch {}
  $vals += [pscustomobject]@{ Tab = $i; Value = $t }
  Write-Host ("TAB[{0}] = [{1}]" -f $i, $t)
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
  Start-Sleep -Milliseconds 80
}

$out = 'C:\Users\Zmart\Desktop\qb-alfuraat-export\invoice-0970-tabdump.csv'
$vals | Export-Csv -Path $out -NoTypeInformation -Encoding UTF8
Write-Host "Wrote $out"
