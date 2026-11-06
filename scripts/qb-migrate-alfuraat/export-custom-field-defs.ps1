$ErrorActionPreference = 'Stop'
$OutDir = 'C:\Users\Zmart\Desktop\qb-alfuraat-export'

function Invoke-Qb($rp, $ticket, $inner) {
  $qbxml = @"
<?xml version="1.0"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="continueOnError">
$inner
  </QBXMLMsgsRq>
</QBXML>
"@
  return $rp.ProcessRequest($ticket, $qbxml)
}

$rp = New-Object -ComObject QBXMLRP2.RequestProcessor
$rp.OpenConnection2('SOM-ERP-Migrate', 'SOM ERP Al Furaat Migrate', 1)
$ticket = $rp.BeginSession('', 2)
try {
  # List custom fields defined on invoices
  $xml = Invoke-Qb $rp $ticket '<PreferencesQueryRq requestID="1"></PreferencesQueryRq>'
  Set-Content -Path (Join-Path $OutDir 'preferences.xml') -Value $xml -Encoding UTF8
  Write-Host "Wrote preferences.xml ($($xml.Length))"

  # Some builds expose DataExtDef
  $xml2 = Invoke-Qb $rp $ticket '<DataExtDefQueryRq requestID="2"><OwnerID>0</OwnerID></DataExtDefQueryRq>'
  Set-Content -Path (Join-Path $OutDir 'dataextdef.xml') -Value $xml2 -Encoding UTF8
  Write-Host "Wrote dataextdef.xml ($($xml2.Length))"

  # Template list may name custom labels
  $xml3 = Invoke-Qb $rp $ticket '<TemplateQueryRq requestID="3"><ActiveStatus>All</ActiveStatus></TemplateQueryRq>'
  Set-Content -Path (Join-Path $OutDir 'templates.xml') -Value $xml3 -Encoding UTF8
  Write-Host "Wrote templates.xml ($($xml3.Length))"
} finally {
  $rp.EndSession($ticket)
  $rp.CloseConnection()
}
