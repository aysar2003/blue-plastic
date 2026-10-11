-- Papers kept against a trash (deletion) log line.
CREATE TABLE "trash_files" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "auditLogId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "trash_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trash_files_orgId_auditLogId_idx" ON "trash_files"("orgId", "auditLogId");

ALTER TABLE "trash_files" ADD CONSTRAINT "trash_files_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trash_files" ADD CONSTRAINT "trash_files_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "audit_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
