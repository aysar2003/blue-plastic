-- Balance date and the 3, 5, or 7 day warning chosen when a customer is registered.

ALTER TABLE "customers" ADD COLUMN "balanceDate" DATE,
ADD COLUMN "reminderDays" SMALLINT;
