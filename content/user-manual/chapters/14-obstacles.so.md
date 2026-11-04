Natiijooyin ka yimid isticmaal sida shaqaale maalinle. Marka hore sax geedi socodka; IT weydii kaliya marka fariintu bug tahay.

### Navigation

- **Back** waa inuu ka baxo record-ka ama xiro dialog. Haddii dialog furan yahay, Back marka hore wuu xirayaa dialog-ka, ka dibna bogga hore.
- Kadib Delete journal, waa inaad ku dhacdo liiska journals; spinner dheer inta badan waa server gaabis ama bog weli la compile-gareynayo development.

### Journal delete + payroll

Delete journal **Payroll** waa inuu payroll run ku celiyo **Draft**. Haddii delete uu ku fashilmo “has been deleted and cannot be changed”, systemku wuxuu isku dayay inuu wax ka beddelo journal la withdraw-gareeyey (waa la saxay: ha nadiifin idempotency key kadib soft-delete; re-post wuxuu sameeyaa key cusub). Isku day markale, ama Delete ka payroll run.

### Posting la diiday

- Period xiran — fur ama isticmaal taariikh furan.
- Account expense/income/bank maqan document ama employee wage card.
- Journal lines aan balanced ahayn — sax debit/credit.
- Payroll net eber — waxba lama post-gado.

### Yaabkaydka kaydka

- Items aan inventory ahayn waligood tirada ma beddelaan.
- Alaab isku mid ah laba jeer (bill + journal gacanta) — hal dariiq document ah.
- Adjustment waa qalabka saxda ah ee farqiga tirada.

### Permissions iyo features

Delete/Reverse/Post maqan — inta badan role ama **Apps & features**, ma aha badhan jabay. Hubi admin.

### Screens gaabis / madhan

Development-ka, furitaanka ugu horreeya ee route weyn wuxuu qaadan karaa ilbiriqsiyo badan. Sug illaa cinwaanka boggu isbeddelo; refresh hal mar haddii aad aragto error page kadib server la dilay.
