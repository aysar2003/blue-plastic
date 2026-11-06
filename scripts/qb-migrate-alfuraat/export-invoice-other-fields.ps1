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
  # Explicitly request Other / custom-ish header fields
  $inner = @'
<InvoiceQueryRq requestID="1">
  <RefNumber>0970</RefNumber>
  <IncludeLineItems>false</IncludeLineItems>
  <IncludeRetElement>RefNumber</IncludeRetElement>
  <IncludeRetElement>PONumber</IncludeRetElement>
  <IncludeRetElement>Other</IncludeRetElement>
  <IncludeRetElement>Memo</IncludeRetElement>
  <IncludeRetElement>FOB</IncludeRetElement>
  <IncludeRetElement>ShipMethodRef</IncludeRetElement>
  <IncludeRetElement>SalesRepRef</IncludeRetElement>
  <IncludeRetElement>CustomerMsgRef</IncludeRetElement>
  <IncludeRetElement>DataExtRet</IncludeRetElement>
  <OwnerID>0</OwnerID>
</InvoiceQueryRq>
'@
  $xml = Invoke-Qb $rp $ticket $inner
  Set-Content -Path (Join-Path $OutDir 'invoice-0970-other.xml') -Value $xml -Encoding UTF8
  Write-Host $xml

  # DataExtDef assigned to Invoice
  $def = @'
<DataExtDefQueryRq requestID="2">
  <AssignToObject>Invoice</AssignToObject>
</DataExtDefQueryRq>
'@
  try {
    $xml2 = Invoke-Qb $rp $ticket $def
    Set-Content -Path (Join-Path $OutDir 'dataextdef-invoice.xml') -Value $xml2 -Encoding UTF8
    Write-Host "dataextdef-invoice: $($xml2.Length)"
  } catch {
    Write-Host "DataExtDef AssignToObject failed"
  }

  # All owner GUID 0 variants + empty OwnerID list
  $def2 = '<DataExtDefQueryRq requestID="3"></DataExtDefQueryRq>'
  try {
    $xml3 = Invoke-Qb $rp $ticket $def2
    Set-Content -Path (Join-Path $OutDir 'dataextdef-all.xml') -Value $xml3 -Encoding UTF8
    Write-Host "dataextdef-all: $($xml3.Length)"
  } catch {
    Write-Host "DataExtDef all failed"
  }
} finally {
  $rp.EndSession($ticket)
  $rp.CloseConnection()
}
