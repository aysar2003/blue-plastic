-- Offline POS queue: idempotent sync key per organisation.
ALTER TABLE "pos_orders" ADD COLUMN "clientSaleId" TEXT;

CREATE UNIQUE INDEX "pos_orders_orgId_clientSaleId_key" ON "pos_orders"("orgId", "clientSaleId");
