# Buugga isticmaalaha — SOM ERP

Hagitaan tallaabo-tallaabo. Magacyada badhamada iyo menu-yada waa **English** sida screen-ka; sharaxaadda waa Soomaali.


---

## 1. Sida loo dhexmiro

### Yaa loogu talagalay

Qof kasta oo SOM ERP u soo gala shaqada maalinlaha: iib, iibsi, kayd, payroll, ama xisaabaad. Cutubyada shaqaalaha uma baahna tababar xisaabeed. Cutubyada xisaabiyaha waxay sharxaan maxaa buugaagtu u diidaan qaar ka mid ah wax-ka-beddelka.

### Soo galitaanka iyo shirkadda

1. Fur URL-ka shirkadda oo geli email iyo password.
2. Haddii aad leedahay shirkado badan, isticmaal **Switch company** (bidix sare) si aad u noqoto buugaagta saxda ah.
3. Magacaaga iyo doorka waxay ku yaalliin **Account menu**. Profile iyo password: **Settings → Your profile**.

### Apps, navigation, iyo search

- **Apps** (ama bidixda) waxay furtaa module kasta: Sales, Purchases, Inventory, Banking, Accounting, Employees, iwm.
- Xariiqda sare ee module-ka waxay muujisaa screens-ka app-kaas (tusaale Invoices, Payments, Customers).
- **Search ⌘K** (ama Ctrl K) waxay kuu geynaysaa customers, vendors, documents, iyo help adigoo qoraya dhawr xaraf.
- **Create** waxay bilaabaysaa invoice, bill, payment, journal cusub iyada oo aadan menu dheeraad ah raadinayn.

### Erayada aad arki doonto

- **Draft** — waa la keydiyay laakiin weli ma gelin ledger-ka. Waa la beddeli / delete kari karaa si ammaan ah.
- **Posted** — wuxuu ku jiraa buugaagta. Lacagaha lama qoro dib; sax **Delete** (withdraw) ama **Reverse** marka la bixiyo.
- **Open / Paid / Partial** — intee baa weli lagu leeyahay invoice ama bill.
- Magacyada badhamada screen-ka had iyo jeer waa **English** xitaa marka hagitaankan Soomaaliga yahay.

### Sida “saxda ah” u egtahay

Post kaliya marka document-ku sax yahay. Doorob reverse ama delete nadiif ah (haddii Settings uu oggolaado delete journal) halkii aad ku qasbi lahayd edit. Haddii screen uu diido ficil, akhri fariinta — inta badan waxay magacawdaa period xiran, account maqan, ama permission.


---

## 2. Dejinta shirkadda

Samee tan hal mar shirkad kasta (ama marka ganacsigu isbeddelo). Kala hormarisku waa muhiim.

### 1. Chart of accounts

Fur [Chart of accounts](/accounts). Ku hay chart-ka caadiga ah, ka dibna magac-beddel oo ku dar bank, cash, expense, iyo income accounts-ka ganacsigani dhab ahaan isticmaalo. Ha tirtirin accounts taariikh leh.

### 2. Organisation

[Settings → Organisation](/settings/organization): magaca sharci, cinwaan, logo, **base currency**, iyo bisha sannadka maaliyadeed ku bilaabmo.

### 3. Default accounts

[Settings → Default accounts](/settings/accounts): meesha receivables, payables, undeposited funds, inventory, opening balance equity iyo kuwa la midka ah ay u post-gaan. Defaults qaldan waxay ka dhigaan document kasta meel qaldan.

### 4. Tax

[Settings → Tax](/settings/tax): shida tax haddii loo baahdo, ka dibna agencies, rates, iyo codes **kahor** iib ama iibsi canshuur leh.

### 5. Dadka iyo alaabta

1. [Customers](/customers) — cidda aad iibiso; opening balances haddii buugaagtu aanay cusbayn.
2. [Vendors / Suppliers](/purchases) — cidda aad ka iibsato.
3. [Products & services](/items) — accounts iib iyo iibsi; **Inventory product** kaliya ayaa tirada kaydka xisaabiya.

### 6. Users iyo apps

[Settings → Company users](/settings/users): roles iyo apps qof kasta furi karo. [Settings → Apps & features](/settings/apps): modules on/off shirkaddan.

### 7. Journal delete (ikhtiyaari)

Configuration / Settings ayaa go’aamiya in **Delete** la bixiyo journals posted ah. **Reverse** waa dariiqa audit-ka ugu nabdoon; delete waxay ka saartaa balances laakiin history way sii haynaysaa marka la oggolaado.


---

## 3. Iib — invoice ilaa lacagta

### Iib, bilow ilaa dhamaad

1. Samee customer haddii loo baahdo ([Customers](/customers)).
2. Samee **Invoice** ([New invoice](/sales/invoices/new)) — macmiilku waa ku leeyahay. Ama **Sales receipt** haddii isla markiiba bixiyey.
3. Keydi, hubi lines (item, qty, rate, tax), ka dib **Post**. Posting waxay debit-gareysaa Accounts Receivable oo credit-gareysaa income (iyo tax).
4. **Receive payment** ee invoice-ka ([Payments](/payments/new)). Cash ama undeposited funds kor ayay u kacaan; receivable-na hoos.
5. Haddii lacagtu Undeposited Funds ku jirtay, qor **Deposit** marka bangiga gaadho ([Banking → Deposit](/banking/deposits/new)).

### Estimates iyo quotations

**Estimates** ama **Quotations** waa soo jeedin. Ledger-ka ma galaan ilaa aad u beddesho invoice, sales order, ama receipt (sida geedi socodkaagu u oggol yahay).

### Celinta

Celintu waa **Credit memo**, oo lagu dabaqo invoice-ka — waligaa ha beddelin invoice posted ah. ([Credit memos](/sales/credit-memos/new))

### Delivery

**Sales delivery** / dispatch notes waxay raadraacaan waxa ka baxay bakhaarka. Kaydka inventory items wuxuu u dhaqaaqaa xeerarka document-kaas.

### Keyboard foomaska

Magaca customer ayaa ugu horreeya. Tab ku dhexmar date iyo lines. **Ctrl S** keydi oo xidh; **Ctrl Shift S** keydi oo mid cusub fur. Liis buuxa: [Keyboard shortcuts](/help/shortcuts).


---

## 4. Iibsi — biilal iyo kharashyo

### Bill iyo expense

- **Bill** waa wax aad weli ku leedahay vendor-ka. Wuxuu u post-gaa Accounts Payable.
- **Expense** waa wax horay loo bixiyey (cash/card/bank isla markiiba).

Fur [Bills](/purchases/bills/new) ama Expenses ka Purchases. Kharashyada geli categories (kira, shidaal); alaabta geli **items**. Kaliya item lines ayaa kaydka dhaqaajiya.

### Bixinta vendors

Isticmaal [Bill payments](/bill-payments/new): hal payment waxay xalli kartaa biilal badan. Payment-ku wuxuu ka saaraa cash oo nadiifiyaa payables.

### Vendor credits

**Vendor credit** waxay yareysaa waxa aad ku leedahay oo waxaa loo dabaqaa sida payment ([Vendor credits](/purchases/vendor-credits/new)).

### Purchase orders iyo helitaanka

1. Samee **Purchase order** marka aad dalbanayso laakiin weli aanay alaabtu iman.
2. Marka ay timaado, isticmaal **Delivery** / receive si tiradu ugu ekaato dalabka.
3. Geli **Bill** ee invoice-ka vendor; ku xidh PO marka systemku bixiyo si tirada dalabku run ahaantii u sii ahaato.

### Khalad caadi ah

Beddelka lacagaha bill posted ah waa la diidaa. Void/delete (service-ku wuxuu ka saaraa journal iyo kayd) ama geli vendor credit — ha sameynin bill labaad oo kaydka laba jeer tiriyo.


---

## 5. Kaydka, store, iyo barcodes

### Inventory products

Kaliya item-ka noociisu yahay **Inventory product** ayaa tirada kaydka xisaabiya. Nooca waa go’an marka item-ka la sameeyo. Samee products [Products & services](/items) adigoo dooranaya accounts iib/iibsi; kayd furitaan: quantity iyo cost (waxay u post-gadaan inventory vs Opening Balance Equity).

### Sida kaydku u dhaqaaqo

- **Gudaha** — bills/expenses leh item lines, adjustments kor, assembly builds (qaybo → dhammaystiran).
- **Dibadda** — iibinta items la raadraaco, adjustments hoos, builds qaybaha cunaya.
- Iibinta item la raadraaco waxay sidoo kale post-gareysaa **cost** (weighted average) isla entry-ga iibka.

### Stock on hand iyo store

[Stock on hand](/inventory/stock) waxay muujisaa tirada iyo qiimaha. **Store** waxay muujisaa tirada bakhaar/goob marka multi-store la isticmaalo.

### Adjustments

Marka tiradu ka duwan tahay buugaagta, qor [Inventory adjustment](/inventory/adjustments/new). Farqiga wuxuu u post-gaa Inventory Shrinkage (ama account-ka defaults). Ha “hagaajinin” kaydka adigoo beddelaya bills duug ah.

### Barcodes

[Barcodes](/barcodes) — generate, print labels, Excel. Waxtar till iyo bakhaar; ma beddelaan receiving iyo sales documents sax ah.


---

## 6. Bangiga iyo deposits

### Accounts

[Banking → Accounts](/banking/accounts) waxay liis gareysaa cash iyo bank ledger accounts. Mid fur si aad u aragto register-ka oo aad uga reconcile-gareyso statement-ka.

### Transfer

[Transfer](/banking/transfers/new) waxay u raraysaa lacag labada account ee aad maamusho (tusaale cash drawer → bank). Labada dhinac waxay ku wada jiraan hal journal balanced ah.

### Deposit

[Deposit](/banking/deposits/new) waxay bangiga gelisaa payments Undeposited Funds ku jiray. Dooro payments-ka ku jira; deposit-ku wuxuu u post-gaa bank account-ka la doortay.

### Import iyo reconcile

Soo deji statement marka la bixiyo, ka dibna calaamadee lines cleared ah ilaa farqigu eber noqdo. Reconcile account kasta firfircoon kahor intaadan xirin bisha.

### Deletes

Tirtiridda transfer ama deposit waxay ka saartaa journal-keeda oo payments-ka dib ugu celisaa meeshii (tusaale undeposited). Akhri qoraalka consequence ee dialog-ka Delete.


---

## 7. Point of Sale (POS)

Isticmaal cutubkan kaliya marka **Point of Sale** furan yahay Settings → Apps & features.

### Maalin caadi ah

1. Fur [Point of Sale](/pos) / Dashboard.
2. Bilow ama sii wad **Session** till-ka (cash drawer).
3. Geli **Orders** / iibyo; qaado payment cash ama hababka POS-kaagu oggol yahay.
4. **Quotations** till-ka waa ikhtiyaari — u beddel ama tuur sida siyaasadda dukaanka.
5. Xiritaanka: **Close session** — tir drawer-ka, qor cash moves, dhammee close si session-ku u post-gato nadiif.

### Cash moves

Lacag ka soo / u baxda drawer-ka (petty cash, bank drop) waa inay marto POS cash-move si session iyo ledger isu waafaqaan.

### Haddii POS xiran yahay

Iibku weli wuxuu ka shaqeeyaa Sales (invoices iyo receipts). Ha u sameynin iib till ah journals gacanta ah illaa xisaabiyuhu ku amro.


---

## 8. Journals, delete, iyo reverse

### Manual journals

[Journal entries](/journals) — post debits iyo credits gacanta marka document iib/iibsi aanu ku filnayn ([New entry](/journals/new)). Line kasta account; totals waa inay isu ekaadaan.

### Posted amounts waligood lama qoro dib

Kadib post, lama beddeli karo lacagaha lines. Labo qalab ayaa muuqda marka Settings oggolaado:

- **Delete** — ka saaraa entry balances iyo reports; row-ga history ahaan wuu sii jiraa. Journals document leh (invoice, bill, payroll, …) waxaa laga delete-gareeyaa document-kaas si labada dhinac isu waafaqaan.
- **Reverse** — waxay post-gareysaa entry ka soo horjeeda; labaduba waa la arkaa.

Configuration → Settings ayaa go’aamiya in Delete la bixiyo.

### Payroll journals

Journal-ka payroll waxaa leh payroll run. Delete waxay run-ka ku celisaa **Draft** si aad u saxdo payslips oo aad dib u post-gato. Ha isku dayin inaad wax ka beddesho lines-kii hore.

### Source column

Fur journal si aad u aragto **Source** (Invoice, Bill, Payroll, Manual, …). Doorob inaad ka saxdo document-ka asalka ah marka jiro.


---

## 9. Dhamaadka bisha iyo sannadka

### Bil kasta

1. Dhammee bank imports iyo **reconcile** ([Banking](/banking/accounts)).
2. Fur [Periods](/periods) oo ka shaqee **close checklist** — sax wax kasta oo ay calaamadisay (trial balance, balance sheet, stock vs inventory account, iwm).
3. Akhri [Profit & loss](/reports/profit-loss) iyo [Balance sheet](/reports/balance-sheet).
4. **Close** period-ka. Waxba uma post-gaan bil xiran illaa qof si ula kac ah u furo.

### Sannad kasta

1. Post adjusting journals (depreciation, accruals) marka loo baahdo ([New journal](/journals/new)).
2. Hubi warbixinnada adjusting entries.
3. Xir sannadka maaliyadeed si faa’iidadu ugu daadato Retained Earnings oo bilaha u xirmaan.

### Haddii aad u baahatid inaad wax ka beddesho bil xiran

Fur period-ka Periods (permission), sax reverse/delete/documents cusub, ka dibna dib u xir. Ha ka tagin periods furan si aan xad lahayn.


---

## 10. Warbaahinta ugu horreysa ee la aamino

Ka bilow [Reports](/reports) ama hubs Accounting / Sales / Purchases.

### Kuwa ugu horreeya ee la aamino marka tirooyinku qaldan u muuqdaan

1. [Trial balance](/reports/trial-balance) — wadarta debits waa inay la mid noqoto credits.
2. [Balance sheet](/reports/balance-sheet) — assets = liabilities + equity.
3. [Cash flow](/reports/cash-flow) — waa inuu sharxo dhaqdhaqaaqa bangiga.

Haddii warbixin ay screen-ka ku muujiso farqi, istaag oo baadh kahor intaadan aaminin tirooyin kale.

### Maalin kasta

- **Profit & loss** — dakhli iyo kharash muddo.
- **Customer / vendor ageing** — yaa ku leeyahay yaa.
- Kooxaha Sales, purchases, inventory, banking, POS — faahfaahin shaqo.

### Memorized reports

Keydi filters aad marar badan isticmaasho Memorized Reports si dhamaadka bishu had iyo jeer isku mid u noqdo.


---

## 11. Shaqaalaha, fasax, attendance, payroll

Module Employees (marka la furo). Hagitaan dheeraad ah: [Employees → Guide](/employees/guide).

### Directory

[Directory](/employees) — kaarka qofka: magac, shaqo, manager, wage (**Monthly / Daily / Hourly**) iyo **expense account** (waa lama huraan kahor payroll post).

### Settings (saacad & OT)

[Employees → Settings](/employees/settings) — hours/day, work days/week, overtime after hours, OT multiplier. Hourly payroll iyo unpaid leave → hours waxay ka akhriyaan halkan.

### Contracts

[Contracts](/employees/contracts) — heshiis + PDF optional. **Open + sync wage** → employee card.

### Leave

1. Leave types (paid / unpaid).
2. Allocation → request → approve.
3. Unpaid leave waxay yareysaa payroll (monthly lacag; hourly saacado).

### Attendance & devices

[Attendance](/employees/attendance) — check-in/out ama hours. [Devices](/employees/attendance/devices) — diiwaangeli clocks, map badges, punches (API bearer token marka qalab la isku xiro).

### Payroll

1. [Payroll](/employees/payroll) — samee run **draft** muddo (payslips mushahar).
2. Hubi lines; ku dar bonus/deduction haddii loo baahdo.
3. Dooro **Pay from** iyo **Post payroll**.
4. Run posted waxay ku xiran tahay journal (Source Payroll). **Delete** run ama journal waxay ka saartaa journal oo run-ka ku celisaa **Draft**.

### Budget & policies

[Budget](/employees/budget) — qorshe wage/headcount bilaha (HR plan, ma aha Accounting Budget). [Policies](/employees/policies) — qoraal + PDF; Publish marka shaqaalaha arkaan.


---

## 12. Approvals, projects, iyo documents

Isticmaal kuwan marka shirkaddu app-ka furto.

### Approvals

[Approvals](/approvals) — documents sugaya print/post approval. Ka shaqee **Pending**, ka dibna taariikhda approved. Workflows (haddii la dejiyey) waxay qeexaan cidda saxeexa.

### Projects

[Projects](/projects) — folder shaqo oo ku xidha estimates, sales orders, invoices, POs, iyo bills hal shaqo macmiil. Reports waxay muujisaa in shaqadu faa’iido samaysay iyo in kale.

### Documents & knowledge

[Documents](/documents) — maktabadda faylalka shirkadda. [Knowledge](/knowledge) — wiki / how-tos gudaha (ka duwan buugga Help-kan).

### To-do iyo calendar

[To-do](/todo) iyo [Calendar](/calendar) — tasks iyo xasuusino; ledger-ka ma galaan.


---

## 13. Trash iyo waxa aan la beddeli karin

### Trash

[Settings → Trash](/settings/trash) (ama Activity trash) waxay liis gareysaa records soft-deleted. **Restore** waxay dib u soo celisaa document iyo journals marka dariiqa taageero. **Clear** waa tirtirid joogto ah — u qaado mid aan laga noqon karin.

### Waxa aanan la beddeli karin

- Lacagaha journal **posted** — reverse ama delete (withdraw), waligaa ha dib u qorin.
- **Period** xiran — marka hore fur.
- **Type** inventory item kadib create.
- Xogta shirkad kale — Switch company haddii aad ku jirto org qaldan.

### Permissions

Haddii badhan maqan yahay, role-kaagu permission ma laha (tusaale `journal:reverse`) ama feature waa xiran (journal delete, app dhan). Weydii admin Company users / Apps & features.


---

## 14. Caqabadaha caadiga ah

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

---

## Cutub — Phases 13–19 (2026)

- **Fixed assets** — Accounting → Fixed assets.
- **FX** — Accounting → FX revaluation.
- **Equity** — Accounting → Equity; warbixin Reports → Owner's equity.
- **HR** — Employees → Recruitment: musharrax NEW → Screening → Interview → Offer, kadib Hire (to-do onboarding). Payroll ma qaado qof LEFT.
- **CRM** — Customers → Pipeline iyo Customers → Tickets (fur, due date, xir).
- **MRP** — Inventory → Materials plan: dooro assembly, BOM, PO ama build.
- **Collab apps** — Settings → Apps & features (Sign, Appointments, iwm.). Sign wuxuu email u diraa link-ga saxiixa marka SMTP la xiro.
- **Home KPIs** — Apps (home) dooro KPI cards (faa'iido, AR, reorder, pipeline, biilal, follow-ups).
- **Group books** — Journal gacanta, calaamadee Intercompany si memo-gu u bilaabmo `[IC]`.
- **Backup** — BOM, shaqaalaha, payroll runs, CRM, collab, hedges, kitchen, bins, training. Restore wuu soo celiyaa. Qandaraasyada scanned kuma jiraan.
- **FX hedges** — Accounting → FX hedges.
- **Kitchen** — POS → Kitchen.
- **Bins** — Inventory → Bins & picks.
- **Training** — Employees → Training.
- **Marketplace** — Settings → Marketplace (app-yada first-party).
- **Sign certificate** — Sign → Certificate (SHA-256, ma aha eIDAS).
