-- CreateEnum
CREATE TYPE "ProjectTaskStage" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stage" "ProjectTaskStage" NOT NULL DEFAULT 'TODO',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "deadline" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_access_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requestedModules" JSONB NOT NULL,
    "note" TEXT,
    "status" "AppAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_tasks_orgId_projectId_stage_sequence_idx" ON "project_tasks"("orgId", "projectId", "stage", "sequence");

-- CreateIndex
CREATE INDEX "project_tasks_orgId_assigneeId_stage_idx" ON "project_tasks"("orgId", "assigneeId", "stage");

-- CreateIndex
CREATE INDEX "app_access_requests_status_createdAt_idx" ON "app_access_requests"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "app_access_requests_orgId_status_createdAt_idx" ON "app_access_requests"("orgId", "status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_access_requests" ADD CONSTRAINT "app_access_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_access_requests" ADD CONSTRAINT "app_access_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_access_requests" ADD CONSTRAINT "app_access_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
