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
  # Full invoice by RefNumber with linked txns + OwnerID
  $inner = @'
<InvoiceQueryRq requestID="1">
  <RefNumber>0970</RefNumber>
  <IncludeLineItems>true</IncludeLineItems>
  <IncludeLinkedTxns>true</IncludeLinkedTxns>
  <OwnerID>0</OwnerID>
</InvoiceQueryRq>
'@
  $xml = Invoke-Qb $rp $ticket $inner
  Set-Content -Path (Join-Path $OutDir 'invoice-0970-full.xml') -Value $xml -Encoding UTF8
  Write-Host "Wrote invoice-0970-full.xml ($($xml.Length))"

  # Item receipts / sales orders that might be the IN/ numbers
  foreach ($n in @('01744','1744','01750','1750')) {
    $q = @"
<ItemReceiptQueryRq requestID="ir$n">
  <RefNumber>$n</RefNumber>
  <IncludeLineItems>false</IncludeLineItems>
</ItemReceiptQueryRq>
"@
    try {
      $x = Invoke-Qb $rp $ticket $q
      if ($x -match 'ItemReceiptRet') {
        Set-Content -Path (Join-Path $OutDir "itemreceipt-$n.xml") -Value $x -Encoding UTF8
        Write-Host "Found ItemReceipt $n"
      } else {
        Write-Host "No ItemReceipt $n"
      }
    } catch {
      Write-Host "ItemReceipt $n error"
    }
  }

  foreach ($n in @('01744','1744','01750','1750')) {
    $q = @"
<SalesOrderQueryRq requestID="so$n">
  <RefNumber>$n</RefNumber>
  <IncludeLineItems>false</IncludeLineItems>
</SalesOrderQueryRq>
"@
    try {
      $x = Invoke-Qb $rp $ticket $q
      if ($x -match 'SalesOrderRet') {
        Set-Content -Path (Join-Path $OutDir "salesorder-$n.xml") -Value $x -Encoding UTF8
        Write-Host "Found SalesOrder $n"
      } else {
        Write-Host "No SalesOrder $n"
      }
    } catch {
      Write-Host "SalesOrder $n error"
    }
  }

  # Template query simple
  $t = Invoke-Qb $rp $ticket '<TemplateQueryRq requestID="t1"></TemplateQueryRq>'
  Set-Content -Path (Join-Path $OutDir 'templates.xml') -Value $t -Encoding UTF8
  Write-Host "Wrote templates.xml ($($t.Length))"
} finally {
  $rp.EndSession($ticket)
  $rp.CloseConnection()
}
