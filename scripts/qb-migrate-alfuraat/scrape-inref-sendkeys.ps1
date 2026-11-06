# Bring QBW32 to foreground, Find invoice by number, attempt to copy IN/ via Tab order.
# Usage: powershell -File scripts/qb-migrate-alfuraat/scrape-inref-sendkeys.ps1
# Optional: -Numbers 0970,0971,0969
param(
  [string[]]$Numbers = @('0970')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

$p = Get-Process QBW32 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if (-not $p) { throw 'QBW32 window not found — open Create Invoices in QuickBooks first.' }

$hwnd = $p.MainWindowHandle
if ([Win]::IsIconic($hwnd)) { [Win]::ShowWindow($hwnd, 9) | Out-Null }
[Win]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 600

$out = 'C:\Users\Zmart\Desktop\qb-alfuraat-export\inref-scrape.csv'
if (-not (Test-Path $out)) {
  Set-Content -Path $out -Value 'number,inRef' -Encoding UTF8
}

foreach ($num in $Numbers) {
  Write-Host "Finding invoice $num ..."
  [Win]::SetForegroundWindow($hwnd) | Out-Null
  Start-Sleep -Milliseconds 300
  # Open Find
  [System.Windows.Forms.SendKeys]::SendWait('^f')
  Start-Sleep -Milliseconds 700
  # Type invoice number (assumes Find lands on Invoice # / RefNumber field)
  [System.Windows.Forms.SendKeys]::SendWait($num)
  Start-Sleep -Milliseconds 200
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  Start-Sleep -Milliseconds 1200

  # Heuristic: from Invoice # field, Tab until IN/ (template-dependent).
  # User-confirmed layout: Customer → Date → Invoice# → BillTo → IN/ → PO → Terms
  # After Find, focus is often on Invoice #. Tab twice may reach IN/ on this template.
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('^c')
  Start-Sleep -Milliseconds 200
  $invNo = [System.Windows.Forms.Clipboard]::GetText()

  [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 100
  [System.Windows.Forms.SendKeys]::SendWait('^c')
  Start-Sleep -Milliseconds 200
  $inRef = [System.Windows.Forms.Clipboard]::GetText()

  # If clipboard still looks like invoice number / date, try more tabs
  if ($inRef -eq $invNo -or $inRef -match '^\d{2}-\d{2}-\d{4}$' -or $inRef.Length -gt 40) {
    for ($i = 0; $i -lt 4; $i++) {
      [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
      Start-Sleep -Milliseconds 120
      [System.Windows.Forms.SendKeys]::SendWait('^a')
      Start-Sleep -Milliseconds 80
      [System.Windows.Forms.SendKeys]::SendWait('^c')
      Start-Sleep -Milliseconds 150
      $cand = [System.Windows.Forms.Clipboard]::GetText()
      if ($cand -and $cand -ne $invNo -and $cand -notmatch '^\d{2}-\d{2}-\d{4}$' -and $cand.Length -le 40) {
        $inRef = $cand
        break
      }
    }
  }

  Write-Host ("  invoiceClipboard={0} inRef={1}" -f $invNo, $inRef)
  if ($inRef -and $inRef -ne $invNo) {
    Add-Content -Path $out -Value ("{0},{1}" -f $num, ($inRef -replace ',', ' ')) -Encoding UTF8
  }
}

Write-Host "Wrote $out"
Get-Content $out
