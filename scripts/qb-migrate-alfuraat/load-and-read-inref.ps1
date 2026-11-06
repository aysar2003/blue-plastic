# Load invoice by Invoice # in Find dialog, then Tab/copy header fields including IN/.
param([string[]]$Numbers = @('0970','0971','0969','1000','0800'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class W5 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

function Focus-Qb {
  $p = Get-Process QBW32 | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
  if (-not $p) { throw 'QBW32 not found' }
  if ([W5]::IsIconic($p.MainWindowHandle)) { [W5]::ShowWindow($p.MainWindowHandle, 9) | Out-Null }
  [W5]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 400
}

function Get-Clip {
  Start-Sleep -Milliseconds 80
  try { return [string][System.Windows.Forms.Clipboard]::GetText() } catch { return '' }
}

function Read-Focused {
  [System.Windows.Forms.Clipboard]::Clear()
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 70
  [System.Windows.Forms.SendKeys]::SendWait('^c')
  return (Get-Clip)
}

$out = 'C:\Users\Zmart\Desktop\qb-alfuraat-export\inref-scrape.csv'
Set-Content -Path $out -Value 'number,po,inRef,memo,rawTabs' -Encoding UTF8

Focus-Qb
[System.Windows.Forms.SendKeys]::SendWait('^i')
Start-Sleep -Milliseconds 800

foreach ($num in $Numbers) {
  Write-Host "=== $num ==="
  Focus-Qb
  [System.Windows.Forms.SendKeys]::SendWait('^f')
  Start-Sleep -Milliseconds 900

  # Clear Customer if junk
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 50
  [System.Windows.Forms.SendKeys]::SendWait('{DELETE}')
  Start-Sleep -Milliseconds 80

  # Tab: Date From, Date To, Invoice #
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}{TAB}{TAB}')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 50
  [System.Windows.Forms.SendKeys]::SendWait($num)
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  Start-Sleep -Milliseconds 1600

  # Escape any leftover dialog
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
  Start-Sleep -Milliseconds 300
  Focus-Qb

  # Walk tabs from top: Shift+Tab many, then collect first 20 values
  for ($i = 0; $i -lt 20; $i++) {
    [System.Windows.Forms.SendKeys]::SendWait('+{TAB}')
    Start-Sleep -Milliseconds 30
  }
  Start-Sleep -Milliseconds 150

  $vals = @()
  for ($i = 0; $i -lt 18; $i++) {
    $v = (Read-Focused) -replace '[\r\n]+', ' ' -replace ',', ';'
    if ($v -and $v -notmatch 'not in the Customer') { $vals += $v }
    [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
    Start-Sleep -Milliseconds 60
  }

  Write-Host ("  tabs: " + ($vals -join ' | '))

  # Heuristic: invoice number, date, po (often numeric), inRef (often 0-padded), memo
  $inv = ($vals | Where-Object { $_ -eq $num -or $_ -eq $num.TrimStart('0') } | Select-Object -First 1)
  $po = ($vals | Where-Object { $_ -match '^\d{4,6}$' -and $_ -ne $num -and $_ -ne $inv } | Select-Object -First 1)
  $inCand = ($vals | Where-Object { $_ -match '^0\d{3,}$' -and $_ -ne $num } | Select-Object -First 1)
  if (-not $inCand) {
    $inCand = ($vals | Where-Object { $_ -match '^\d{4,5}$' -and $_ -ne $num -and $_ -ne $po } | Select-Object -First 1)
  }
  $memo = ($vals | Where-Object { $_.Length -gt 8 -and $_ -notmatch '^\d' -and $_ -notmatch 'DEEQA|ASAL|Copy of' } | Select-Object -First 1)

  $line = '{0},{1},{2},{3},"{4}"' -f $num, $po, $inCand, $memo, (($vals -join '||') -replace '"', "''")
  Add-Content -Path $out -Value $line -Encoding UTF8
  Write-Host ("  parsed po={0} inRef={1}" -f $po, $inCand)
}

Write-Host "Wrote $out"
Get-Content $out
