-- Staff assigned to a POS counter (register). Empty set = anyone with POS access.
CREATE TABLE "pos_register_staff" (
    "registerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "pos_register_staff_pkey" PRIMARY KEY ("registerId","userId")
);

CREATE INDEX "pos_register_staff_userId_idx" ON "pos_register_staff"("userId");

ALTER TABLE "pos_register_staff" ADD CONSTRAINT "pos_register_staff_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "pos_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_register_staff" ADD CONSTRAINT "pos_register_staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
