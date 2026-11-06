$ErrorActionPreference = 'Stop'
$OutDir = 'C:\Users\Zmart\Desktop\qb-alfuraat-export'

function Invoke-Qb($rp, $ticket, $inner) {
  $qbxml = "<?xml version=`"1.0`"?>`n<?qbxml version=`"13.0`"?>`n<QBXML>`n  <QBXMLMsgsRq onError=`"continueOnError`">`n$inner`n  </QBXMLMsgsRq>`n</QBXML>"
  return $rp.ProcessRequest($ticket, $qbxml)
}

$rp = New-Object -ComObject QBXMLRP2.RequestProcessor
$rp.OpenConnection2('SOM-ERP-Migrate', 'SOM ERP Al Furaat Migrate', 1)
$ticket = $rp.BeginSession('', 2)
try {
  $objects = @(
    'Customer','Vendor','Employee','Item','Invoice','SalesReceipt','CreditMemo',
    'Estimate','SalesOrder','PurchaseOrder','Bill','VendorCredit','ReceivePayment',
    'JournalEntry','Deposit','Check','Account','CustomerMsg','OtherName','Company'
  )
  $sb = New-Object System.Text.StringBuilder
  foreach ($obj in $objects) {
    $inner = "<DataExtDefQueryRq requestID=`"$obj`"><AssignToObject>$obj</AssignToObject><OwnerID>0</OwnerID></DataExtDefQueryRq>"
    try {
      $xml = Invoke-Qb $rp $ticket $inner
      [void]$sb.AppendLine("=== $obj ===")
      [void]$sb.AppendLine($xml)
      if ($xml -match 'DataExtDefRet') { Write-Host "FOUND defs on $obj" }
      else { Write-Host "none on $obj" }
    } catch {
      Write-Host "err $obj : $_"
    }
  }
  Set-Content -Path (Join-Path $OutDir 'dataextdef-all-objects.xml') -Value $sb.ToString() -Encoding UTF8

  # Preferenced / company
  $pref = Invoke-Qb $rp $ticket '<PreferencesQueryRq requestID="pref1"></PreferencesQueryRq>'
  Set-Content (Join-Path $OutDir 'preferences-full.xml') $pref -Encoding UTF8
  Write-Host "preferences saved $($pref.Length)"

  # Scan ALL invoice memos/FOB/Other/Class for any non-empty rare fields
  $inner2 = @'
<InvoiceQueryRq requestID="scan">
  <IncludeLineItems>false</IncludeLineItems>
  <OwnerID>0</OwnerID>
</InvoiceQueryRq>
'@
  # iterator in chunks by ModifiedDate range is heavy; use TxnDateRangeFilter years
  $years = 2020..2026
  $hits = 0
  foreach ($y in $years) {
    $q = @"
<InvoiceQueryRq requestID="y$y">
  <TxnDateRangeFilter>
    <FromTxnDate>$y-01-01</FromTxnDate>
    <ToTxnDate>$y-12-31</ToTxnDate>
  </TxnDateRangeFilter>
  <IncludeLineItems>false</IncludeLineItems>
  <OwnerID>0</OwnerID>
</InvoiceQueryRq>
"@
    $xml = Invoke-Qb $rp $ticket $q
    $path = Join-Path $OutDir ("invoices-headers-$y.xml")
    Set-Content $path $xml -Encoding UTF8
    $other = ([regex]::Matches($xml, '<Other>[^<]+</Other>')).Count
    $fob = ([regex]::Matches($xml, '<FOB>[^<]+</FOB>')).Count
    $memo = ([regex]::Matches($xml, '<Memo>[^<]+</Memo>')).Count
    $dext = ([regex]::Matches($xml, 'DataExtRet')).Count
    Write-Host ("{0}: other={1} fob={2} memo={3} dext={4} len={5}" -f $y, $other, $fob, $memo, $dext, $xml.Length)
    $hits += $other + $dext
  }
  Write-Host "total other+dext hits: $hits"
} finally {
  $rp.EndSession($ticket) | Out-Null
  $rp.CloseConnection() | Out-Null
}
