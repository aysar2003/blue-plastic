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
