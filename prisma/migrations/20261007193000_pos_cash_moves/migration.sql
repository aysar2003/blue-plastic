-- Cash in / cash out during an open POS session.

CREATE TYPE "PosCashMoveKind" AS ENUM ('IN', 'OUT');

CREATE TABLE "pos_cash_movements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "PosCashMoveKind" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_cash_movements_sessionId_createdAt_idx" ON "pos_cash_movements"("sessionId", "createdAt" DESC);
CREATE INDEX "pos_cash_movements_orgId_createdAt_idx" ON "pos_cash_movements"("orgId", "createdAt" DESC);

ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
