-- Promise date and time written when a vendor is registered. Overdue reads these.

ALTER TABLE "vendors" ADD COLUMN "agreementDate" DATE,
ADD COLUMN "balanceDate" DATE,
ADD COLUMN "balanceTime" TEXT,
ADD COLUMN "reminderDays" SMALLINT;
