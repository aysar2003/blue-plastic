-- Point of sale: payment methods, registers, orders, and POS-enabled items.

ALTER TABLE "items" ADD COLUMN "availableInPos" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "pos_payment_methods" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_registers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storeId" TEXT,
    "defaultCustomerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_registers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_register_methods" (
    "registerId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,

    CONSTRAINT "pos_register_methods_pkey" PRIMARY KEY ("registerId","paymentMethodId")
);

CREATE TABLE "pos_orders" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "salesDocumentId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_order_payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "pos_order_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_payment_methods_orgId_name_key" ON "pos_payment_methods"("orgId", "name");
CREATE INDEX "pos_payment_methods_orgId_isActive_sortOrder_idx" ON "pos_payment_methods"("orgId", "isActive", "sortOrder");

CREATE UNIQUE INDEX "pos_registers_orgId_name_key" ON "pos_registers"("orgId", "name");
CREATE INDEX "pos_registers_orgId_isActive_idx" ON "pos_registers"("orgId", "isActive");

CREATE UNIQUE INDEX "pos_orders_salesDocumentId_key" ON "pos_orders"("salesDocumentId");
CREATE INDEX "pos_orders_orgId_registerId_createdAt_idx" ON "pos_orders"("orgId", "registerId", "createdAt" DESC);

CREATE INDEX "pos_order_payments_orderId_idx" ON "pos_order_payments"("orderId");

ALTER TABLE "pos_payment_methods" ADD CONSTRAINT "pos_payment_methods_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_payment_methods" ADD CONSTRAINT "pos_payment_methods_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_registers" ADD CONSTRAINT "pos_registers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_registers" ADD CONSTRAINT "pos_registers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_registers" ADD CONSTRAINT "pos_registers_defaultCustomerId_fkey" FOREIGN KEY ("defaultCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_register_methods" ADD CONSTRAINT "pos_register_methods_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "pos_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_register_methods" ADD CONSTRAINT "pos_register_methods_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "pos_payment_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "pos_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_salesDocumentId_fkey" FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_order_payments" ADD CONSTRAINT "pos_order_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_order_payments" ADD CONSTRAINT "pos_order_payments_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "pos_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
