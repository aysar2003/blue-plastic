# Open Find Invoices, search by Invoice #, leave that invoice on screen.
param([string]$Number = '0970')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win3 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@

function Focus-Qb {
  $p = Get-Process QBW32 | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
  if (-not $p) { throw 'QBW32 not found' }
  $hwnd = $p.MainWindowHandle
  if ([Win3]::IsIconic($hwnd)) { [Win3]::ShowWindow($hwnd, 9) | Out-Null }
  [Win3]::SetForegroundWindow($hwnd) | Out-Null
  Start-Sleep -Milliseconds 500
  return $hwnd
}

Focus-Qb | Out-Null
# Ensure Create Invoices: Ctrl+I
[System.Windows.Forms.SendKeys]::SendWait('^i')
Start-Sleep -Milliseconds 900
Focus-Qb | Out-Null

# Open Find
[System.Windows.Forms.SendKeys]::SendWait('^f')
Start-Sleep -Milliseconds 1000

# Find Invoices dialog: left filter list — type "Invoice #" to jump, Enter to select
[System.Windows.Forms.SendKeys]::SendWait('Invoice #')
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 400

# Value box should be focused — clear and type number
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait($Number)
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 1500

Write-Host "Find requested for Invoice # $Number - check QB window"
