# Scrapes IN/ labels/edits from the open QuickBooks Create Invoices window via UI Automation.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

function Get-QbWindow {
  $procs = Get-Process | Where-Object {
    ($_.ProcessName -eq 'QBW32' -or $_.MainWindowTitle -match 'QuickBooks|AL-FURAAT') -and $_.MainWindowHandle -ne [IntPtr]::Zero
  }
  foreach ($p in $procs) {
    $el = [System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
    if ($el) { return $el }
  }
  throw 'QuickBooks window not found'
}

function Get-Value($el) {
  if (-not $el) { return '' }
  try {
    $vp = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    return [string]$vp.Current.Value
  } catch {
    return [string]$el.Current.Name
  }
}

$root = Get-QbWindow
Write-Host ("QB window: {0}" -f $root.Current.Name)

$labels = $root.FindAll(
  [System.Windows.Automation.TreeScope]::Descendants,
  (New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Text
  ))
)
foreach ($l in $labels) {
  $n = $l.Current.Name
  if ($n -match 'IN/|P\.O|Invoice|Memo|TERMS|DESCRIPTION|Customer|Bill To') {
    Write-Host ("TEXT name='{0}' id='{1}'" -f $n, $l.Current.AutomationId)
  }
}

$edits = $root.FindAll(
  [System.Windows.Automation.TreeScope]::Descendants,
  (New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Edit
  ))
)
Write-Host ("Edit count: {0}" -f $edits.Count)
$i = 0
foreach ($e in $edits) {
  if ($i -ge 80) { break }
  $val = Get-Value $e
  $nm = $e.Current.Name
  $aid = $e.Current.AutomationId
  if ($nm -or $val -or $aid) {
    Write-Host ("EDIT[{0}] name='{1}' id='{2}' value='{3}'" -f $i, $nm, $aid, $val)
  }
  $i++
}

[System.Windows.Forms.SendKeys]::SendWait('^f')
Start-Sleep -Milliseconds 900
$root = Get-QbWindow
$findEdits = $root.FindAll(
  [System.Windows.Automation.TreeScope]::Descendants,
  (New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Edit
  ))
)
Write-Host ("After Ctrl+F edit count: {0}" -f $findEdits.Count)
$fi = 0
foreach ($e in $findEdits) {
  if ($fi -ge 40) { break }
  Write-Host ("FIND_EDIT[{0}] name='{1}' id='{2}' value='{3}'" -f $fi, $e.Current.Name, $e.Current.AutomationId, (Get-Value $e))
  $fi++
}
