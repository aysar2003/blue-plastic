-- POS cash sessions: open/close with opening float; orders can belong to a session.

CREATE TYPE "PosSessionStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "pos_sessions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "status" "PosSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(6),
    "openingCash" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "closingCash" DECIMAL(19,4),
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "pos_orders" ADD COLUMN "sessionId" TEXT;

CREATE INDEX "pos_sessions_orgId_status_openedAt_idx" ON "pos_sessions"("orgId", "status", "openedAt" DESC);
CREATE INDEX "pos_sessions_registerId_status_idx" ON "pos_sessions"("registerId", "status");
CREATE UNIQUE INDEX "pos_sessions_one_open_per_register" ON "pos_sessions"("registerId") WHERE "status" = 'OPEN';

CREATE INDEX "pos_orders_sessionId_createdAt_idx" ON "pos_orders"("sessionId", "createdAt" DESC);

ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "pos_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
