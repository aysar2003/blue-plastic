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
