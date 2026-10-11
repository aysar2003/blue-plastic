-- Organisation calendar: meetings, appointments, and timed reminders.
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'meeting',
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "reminderMinutes" INTEGER,
    "reminderDismissedAt" TIMESTAMPTZ(6),
    "createdById" TEXT NOT NULL,
    "customerId" TEXT,
    "vendorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calendar_events_orgId_startsAt_idx" ON "calendar_events"("orgId", "startsAt");
CREATE INDEX "calendar_events_orgId_endsAt_idx" ON "calendar_events"("orgId", "endsAt");
CREATE INDEX "calendar_events_orgId_reminderDismissedAt_startsAt_idx" ON "calendar_events"("orgId", "reminderDismissedAt", "startsAt");

ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
