# SOM ERP — User manual

Step-by-step guide for people who work in the system. Button and menu names match the **English** screens.


---

## 1. Getting around

### Who this is for

Anyone who signs into SOM ERP to do daily work: sales, purchases, stock, payroll, or accounts. You do not need accounting training to follow the staff chapters. Accountant chapters explain why the books refuse some edits.

### Sign in and company

1. Open the company URL and sign in with your email and password.
2. If you belong to more than one company, use **Switch company** (top left) so you are in the right books.
3. Your name and role sit under **Account menu**. Profile and password are under **Settings → Your profile**.

### Apps, navigation, and search

- **Apps** (or the left rail) opens each module: Sales, Purchases, Inventory, Banking, Accounting, Employees, and so on.
- The top strip under the module shows the screens for that app (for example Invoices, Payments, Customers).
- **Search ⌘K** (or Ctrl K) jumps to customers, vendors, documents, and help by typing a few letters.
- **Create** starts a new invoice, bill, payment, journal, and other common documents without hunting through menus.

### Words you will see

- **Draft** — saved but not in the ledger yet. Safe to edit or delete.
- **Posted** — in the books. Amounts are not rewritten; fix with Delete (withdraw) or Reverse where offered.
- **Open / Paid / Partial** — how much is still owed on invoices and bills.
- Button labels on screen are always English even when this Somali guide explains them.

### What “good” looks like

Post only when the document is correct. Prefer a clean reverse or delete (when Settings allow journal delete) over forcing an edit. If a screen refuses an action, read the message — it usually names a closed period, missing account, or permission.


---

## 2. Setting up the company

Do this once per company (or when the business changes). Order matters.

### 1. Chart of accounts

Open [Chart of accounts](/accounts). Install or keep the standard chart, then rename and add the bank, cash, expense, and income accounts this business really uses. Do not delete accounts that already have history.

### 2. Organisation

[Settings → Organisation](/settings/organization): legal name, address, logo, **base currency**, and the month the fiscal year starts.

### 3. Default accounts

[Settings → Default accounts](/settings/accounts): where receivables, payables, undeposited funds, inventory, opening balance equity, and similar roles post. Wrong defaults make every new document land in the wrong place.

### 4. Tax

[Settings → Tax](/settings/tax): turn tax on if needed, then agencies, rates, and codes **before** taxable sales or purchases.

### 5. People and things

1. [Customers](/customers) — who you sell to; opening balances if the books are not new.
2. [Vendors / Suppliers](/purchases) — who you buy from.
3. [Products & services](/items) — sell and buy accounts; only **Inventory product** tracks quantity.

### 6. Users and apps

[Settings → Company users](/settings/users): roles and which apps each person can open. [Settings → Apps & features](/settings/apps): turn modules on or off for this company.

### 7. Journal delete (optional)

Configuration / Settings controls whether **Delete** is offered on posted journals. Reverse is always the safer audit path; delete withdraws balances but keeps history when enabled.


---

## 3. Sales — invoice to cash

### A sale, end to end

1. Create a customer if needed ([Customers](/customers)).
2. Raise an **Invoice** ([New invoice](/sales/invoices/new)) — customer owes you. Or a **Sales receipt** if they paid on the spot.
3. Save, review lines (item, qty, rate, tax), then **Post** when ready. Posting debits Accounts Receivable and credits income (and tax).
4. **Receive payment** against the invoice ([Payments](/payments/new)). Cash or undeposited funds go up; the receivable goes down.
5. If money sat in Undeposited Funds, record a **Deposit** when it hits the bank ([Banking → Deposit](/banking/deposits/new)).

### Estimates and quotations

Use **Estimates** or **Quotations** to propose work. They do not post to the ledger until you convert them into an invoice, sales order, or receipt (as your process allows).

### Returns

A return is a **Credit memo**, applied to the invoice — never an edit of a posted invoice. ([Credit memos](/sales/credit-memos/new))

### Delivery

**Sales delivery** / dispatch notes track what left the warehouse. Stock for inventory items moves with posting rules for that document type.

### Keyboard on forms

Customer name is focused first. Tab through date and lines. **Ctrl S** saves and closes; **Ctrl Shift S** saves and opens another. Full list: [Keyboard shortcuts](/help/shortcuts).


---

## 4. Purchases — bills and expenses

### Bill versus expense

- A **Bill** is something you still owe the vendor. It posts to Accounts Payable.
- An **Expense** is something already paid (cash/card/bank on the spot).

Open [Bills](/purchases/bills/new) or Expenses from Purchases. Enter costs as categories (rent, fuel) and goods as **items**. Only item lines move stock.

### Paying vendors

Use [Bill payments](/bill-payments/new): one payment can settle many bills. The payment posts the cash out and clears payables.

### Vendor credits

A **Vendor credit** reduces what you owe and is applied like a payment ([Vendor credits](/purchases/vendor-credits/new)).

### Purchase orders and receiving

1. Raise a **Purchase order** when you are ordering but have not received goods yet.
2. When goods arrive, use **Delivery** / receive flow so quantities match what was ordered.
3. Enter the **Bill** for the vendor invoice; link to the PO when the system offers it so ordered counts stay honest.

### Common mistake

Editing a posted bill’s amounts is refused. Void/delete (service withdraws the journal and stock) or enter a vendor credit — do not invent a second bill that double-counts stock.


---

## 5. Inventory, store, and barcodes

### Inventory products

Only an item whose type is **Inventory product** tracks quantity. The type is fixed once the item exists. Create products under [Products & services](/items) with sell/buy accounts and, for opening stock, quantity and cost (posts to inventory against Opening Balance Equity).

### How stock moves

- **In** — bills/expenses with item lines, adjustments up, assembly builds (parts → finished).
- **Out** — sales of tracked items, adjustments down, builds consuming parts.
- Selling a tracked item also posts its **cost** (weighted average) in the same ledger entry as the sale.

### Stock on hand and store

[Stock on hand](/inventory/stock) shows quantity and value. **Store** screens show quantity by warehouse/location when multi-store is used.

### Adjustments

When a count disagrees with the books, record an [Inventory adjustment](/inventory/adjustments/new). The difference posts to Inventory Shrinkage (or the account your defaults use). Do not “fix” stock by editing old bills.

### Barcodes

[Barcodes](/barcodes) — generate, print labels, Excel export. Useful at the till and in the warehouse; it does not replace proper receiving and sales documents.


---

## 6. Banking and deposits

### Accounts

[Banking → Accounts](/banking/accounts) lists cash and bank ledger accounts. Open one to see the register and reconcile against the statement.

### Transfer

[Transfer](/banking/transfers/new) moves money between two accounts you control (for example cash drawer → bank). Both sides post in one balanced journal.

### Deposit

[Deposit](/banking/deposits/new) banks payments that were sitting in Undeposited Funds (or similar). Select the payments included; the deposit posts into the chosen bank account.

### Import and reconcile

Import a statement when offered, then tick cleared lines until the difference is zero. Reconcile every active bank/cash account before you close the month.

### Deletes

Deleting a transfer or deposit withdraws its journal and puts related payments back where they belong (for example undeposited). Use the on-screen Delete dialog and read the consequence text.


---

## 7. Point of Sale

Use this chapter only when **Point of Sale** is enabled under Settings → Apps & features.

### Typical day

1. Open [Point of Sale](/pos) / Dashboard.
2. Start or continue a **Session** for the till (cash drawer).
3. Ring **Orders** / sales; take payment as cash or the methods your POS allows.
4. **Quotations** at the till are optional holds — convert or discard per store policy.
5. At close, **Close session**: count the drawer, record any cash moves, and finish the close so the session posts cleanly.

### Cash moves

Moving cash in or out of the drawer (petty cash, bank drop) should go through the POS cash-move flow so the session and the ledger stay aligned.

### If POS is off

Sales still work through Accounting Sales (invoices and receipts). Do not invent till sales as manual journals unless an accountant directs you.


---

## 8. Journals, delete, and reverse

### Manual journals

[Journal entries](/journals) — post balanced debits and credits by hand when no sales/purchase document fits ([New entry](/journals/new)). Every line needs an account; totals must match.

### Posted amounts never rewrite

After post, you cannot edit line amounts. Two tools appear when Settings allow:

- **Delete** — withdraws the entry from balances and reports; the row stays for history. Document-owned journals (invoice, bill, payroll, …) delete through that document so both sides stay consistent.
- **Reverse** — posts an equal opposite entry; both remain visible.

Configuration → Settings controls whether Delete is offered.

### Payroll journals

A payroll source journal is owned by the payroll run. Deleting it returns the run to **Draft** so you can fix payslips and post again. Do not try to edit the old journal lines.

### Source column

Open a journal to see **Source** (Invoice, Bill, Payroll, Manual, …). Prefer fixing from the source document when one exists.


---

## 9. Month-end and year-end

### Every month

1. Finish bank imports and **reconcile** ([Banking](/banking/accounts)).
2. Open [Periods](/periods) and work the **close checklist** — fix anything it flags (trial balance, balance sheet, stock vs inventory account, and more).
3. Read [Profit & loss](/reports/profit-loss) and [Balance sheet](/reports/balance-sheet).
4. **Close** the period. Nothing posts into a closed month unless someone reopens it on purpose.

### Every year

1. Post adjusting journals (depreciation, accruals) marked as adjusting when required ([New journal](/journals/new)).
2. Check adjusting-entry reports.
3. Close the fiscal year so profit sweeps to Retained Earnings and months lock.

### If you must change a closed month

Reopen the period from Periods (permission required), fix with reverse/delete/new documents, then close again. Do not leave periods open indefinitely.


---

## 10. Reports you should trust first

Start from [Reports](/reports) or the Accounting / Sales / Purchases report hubs.

### Trust these first when numbers look wrong

1. [Trial balance](/reports/trial-balance) — total debits must equal total credits.
2. [Balance sheet](/reports/balance-sheet) — assets must equal liabilities plus equity.
3. [Cash flow](/reports/cash-flow) — must explain bank movement.

If any report shows a difference on screen, stop and investigate before trusting other figures.

### Day-to-day

- **Profit & loss** — income and expenses for a period.
- **Customer / vendor ageing** — who owes whom.
- Sales, purchases, inventory, banking, and POS report groups for operational detail.

### Memorized reports

Save filters you reuse under Memorized Reports so month-end is the same every time.


---

## 11. Employees, leave, attendance, payroll

Employees module (when enabled). Longer Somali walkthrough also lives at [Employees → Guide](/employees/guide).

### Directory

[Directory](/employees) — person card: name, job, manager, wage (**Monthly / Daily / Hourly**) and **expense account** (required before payroll can post).

### Settings (hours & OT)

[Employees → Settings](/employees/settings) — hours/day, work days/week, overtime after hours, OT multiplier. Hourly payroll and unpaid-leave hour conversion read these values.

### Contracts

[Contracts](/employees/contracts) — agreement + optional PDF. **Open + sync wage** pushes wage onto the employee card.

### Leave

1. Define leave types (paid / unpaid).
2. Allocation → request → approve.
3. Unpaid leave reduces payroll (monthly money; hourly hours).

### Attendance & devices

[Attendance](/employees/attendance) — manual check-in/out or hours. [Devices](/employees/attendance/devices) — register clocks, map badges, ingest punches (API with bearer token when integrating hardware).

### Payroll

1. [Payroll](/employees/payroll) — create a **draft** run for a period (payslips from wages).
2. Review lines; add bonus/deduction if needed.
3. Choose **Pay from** account and **Post payroll**.
4. Posted run links a journal (source Payroll). **Delete** on the run or on that journal withdraws the journal and returns the run to **Draft**.

### Budget & policies

[Budget](/employees/budget) — planned wage/headcount by month (HR plan, not ledger budget). [Policies](/employees/policies) — company policy text + optional PDF; publish when staff should see it.


---

## 12. Approvals, projects, and documents

Use these when the company has turned the app on.

### Approvals

[Approvals](/approvals) — documents waiting for print/post approval. Work **Pending**, then browse approved history. Workflows (if configured) define who must sign off.

### Projects

[Projects](/projects) — job folders linking estimates, sales orders, invoices, purchase orders, and bills for one customer job. Reports show whether the job made money.

### Documents & knowledge

[Documents](/documents) — company file library. [Knowledge](/knowledge) — internal wiki / how-tos for your organisation’s own procedures (separate from this Help manual).

### To-do and calendar

[To-do](/todo) and [Calendar](/calendar) — personal/team tasks and reminders; they do not post to the ledger.


---

## 13. Trash and what you cannot change

### Trash

[Settings → Trash](/settings/trash) (or Activity trash) lists soft-deleted records. **Restore** puts a document and its journals back when the path supports it. **Clear** permanently removes what policy allows — treat as irreversible.

### What you cannot change

- Posted journal **amounts** — reverse or delete (withdraw), never rewrite.
- Closed **period** — reopen first.
- Inventory item **type** after create.
- Another company’s data — Switch company if you are in the wrong org.

### Permissions

If a button is missing, your role may lack the permission (for example `journal:reverse`) or the feature flag is off (journal delete, an entire app). Ask an admin under Company users / Apps & features.


---

## 14. Common obstacles

Findings from working the product like a daily user. Fix process first; ask IT only when the message is a bug.

### Navigation

- **Back** should leave the current record or close a dialog. If a dialog was open, Back closes the dialog first (dialog stack), then goes to the previous page.
- After Delete on a journal, you should land on the journals list; a stuck spinner usually means the server is slow or the page is still compiling in development.

### Journal delete + payroll

Deleting a **Payroll** journal must return the payroll run to **Draft**. If delete fails with “has been deleted and cannot be changed”, the system was trying to edit a withdrawn journal (fixed in payroll withdraw: do not clear idempotency keys after soft-delete; re-post mints a new key). Retry after that fix, or delete from the payroll run’s Delete button.

### Posting refused

- Closed period — reopen or use an open date.
- Missing expense/income/bank account on the document or employee wage card.
- Unbalanced journal lines — fix debit/credit totals.
- Zero payroll net — nothing to post.

### Stock surprises

- Non-inventory items never change quantity.
- Posting the same goods twice (bill + manual journal) double-counts — use one document path.
- Adjustment is the correct tool for count differences.

### Permissions and features

Missing Delete/Reverse/Post usually means role or **Apps & features**, not a broken button. Confirm with an admin.

### Slow or blank screens

In development, the first open of a large route can take many seconds. Wait for the page title to change; refresh once if you see a browser error page after a killed server.

---

## Chapter — Phases 13–19 (2026)

- **Fixed assets** — Accounting → Fixed assets: categories, register, run monthly depreciation.
- **FX** — Accounting → FX revaluation: review open foreign AR/AP, post revaluation.
- **Equity** — Accounting → Equity: shareholders, contributions, draws, dividends; report under Reports → Owner's equity.
- **HR** — Employees → Recruitment: move a candidate NEW → Screening → Interview → Offer, then Hire (creates an onboarding to-do). Payroll skips people marked LEFT.
- **CRM** — Customers → Pipeline (Lead → Won) and Customers → Tickets (open, due date, close).
- **MRP** — Inventory → Materials plan: pick an assembly, explode the bill of materials, raise a PO for shortages or build.
- **Collab apps** — Enable Sign, Appointments, Discuss, Planning, Surveys under Settings → Apps & features. Sign can email the public signing link when organisation SMTP is connected.
- **Home KPIs** — On Apps (home), tick which KPI cards to show (profit, AR, reorder, pipeline, unpaid bills, follow-ups), then Save.
- **Group books** — On a manual journal, tick Intercompany so the memo starts with `[IC]` and consolidation skips it.
- **Backup** — Databases download includes stock BOM, people, payroll runs/payslips, CRM, collab, hedges, kitchen, bins, training. Restore replays those extras. Scanned contracts stay out.
- **FX hedges** — Accounting → FX hedges: document the risk, item, and instrument, then settle MTM.
- **Kitchen** — POS → Kitchen: send a ticket, bump OPEN → FIRED → READY → DONE.
- **Bins** — Inventory → Bins & picks: human pick tasks.
- **Training** — Employees → Training.
- **Marketplace** — Settings → Marketplace: first-party apps only.
- **Sign certificate** — Sign → Certificate after signed (SHA-256 audit, not eIDAS).
