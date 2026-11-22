-- School ops full: subjects, timetable, assignments, transport, hostel,
-- announcements, discipline (practical LMS/SIS ops — not SCORM).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssignmentSubmissionStatus') THEN
    CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'GRADED', 'RETURNED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SchoolAudience') THEN
    CREATE TYPE "SchoolAudience" AS ENUM ('ALL', 'STAFF', 'PARENTS', 'STUDENTS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisciplineSeverity') THEN
    CREATE TYPE "DisciplineSeverity" AS ENUM ('NOTE', 'WARNING', 'DETENTION', 'SUSPENSION');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school_subjects" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_subjects_orgId_name_key" ON "school_subjects"("orgId", "name");
CREATE INDEX IF NOT EXISTS "school_subjects_orgId_isActive_idx" ON "school_subjects"("orgId", "isActive");

CREATE TABLE IF NOT EXISTS "school_class_subjects" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "teacherName" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_class_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_class_subjects_classId_subjectId_key" ON "school_class_subjects"("classId", "subjectId");
CREATE INDEX IF NOT EXISTS "school_class_subjects_orgId_classId_idx" ON "school_class_subjects"("orgId", "classId");

CREATE TABLE IF NOT EXISTS "timetable_slots" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "periodIndex" INTEGER NOT NULL,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "room" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "timetable_slots_classId_dayOfWeek_periodIndex_key"
  ON "timetable_slots"("classId", "dayOfWeek", "periodIndex");
CREATE INDEX IF NOT EXISTS "timetable_slots_orgId_classId_dayOfWeek_idx"
  ON "timetable_slots"("orgId", "classId", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "school_assignments" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "dueOn" DATE,
  "maxScore" DECIMAL(19,4) NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_assignments_orgId_classId_dueOn_idx"
  ON "school_assignments"("orgId", "classId", "dueOn");

CREATE TABLE IF NOT EXISTS "assignment_submissions" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'ASSIGNED',
  "submittedAt" TIMESTAMPTZ(6),
  "score" DECIMAL(19,4),
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "assignment_submissions_assignmentId_enrollmentId_key"
  ON "assignment_submissions"("assignmentId", "enrollmentId");
CREATE INDEX IF NOT EXISTS "assignment_submissions_orgId_enrollmentId_idx"
  ON "assignment_submissions"("orgId", "enrollmentId");

CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "vehicleNote" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "transport_routes_orgId_name_key" ON "transport_routes"("orgId", "name");
CREATE INDEX IF NOT EXISTS "transport_routes_orgId_isActive_idx" ON "transport_routes"("orgId", "isActive");

CREATE TABLE IF NOT EXISTS "transport_riders" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "stopName" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_riders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "transport_riders_routeId_enrollmentId_key"
  ON "transport_riders"("routeId", "enrollmentId");
CREATE INDEX IF NOT EXISTS "transport_riders_orgId_routeId_idx" ON "transport_riders"("orgId", "routeId");
CREATE INDEX IF NOT EXISTS "transport_riders_enrollmentId_idx" ON "transport_riders"("enrollmentId");

CREATE TABLE IF NOT EXISTS "hostel_blocks" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hostel_blocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_blocks_orgId_name_key" ON "hostel_blocks"("orgId", "name");
CREATE INDEX IF NOT EXISTS "hostel_blocks_orgId_isActive_idx" ON "hostel_blocks"("orgId", "isActive");

CREATE TABLE IF NOT EXISTS "hostel_rooms" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "blockId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 4,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hostel_rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_rooms_blockId_name_key" ON "hostel_rooms"("blockId", "name");
CREATE INDEX IF NOT EXISTS "hostel_rooms_orgId_blockId_idx" ON "hostel_rooms"("orgId", "blockId");

CREATE TABLE IF NOT EXISTS "hostel_allocations" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "bedLabel" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hostel_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_allocations_enrollmentId_key" ON "hostel_allocations"("enrollmentId");
CREATE INDEX IF NOT EXISTS "hostel_allocations_orgId_roomId_idx" ON "hostel_allocations"("orgId", "roomId");

CREATE TABLE IF NOT EXISTS "school_announcements" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" "SchoolAudience" NOT NULL DEFAULT 'ALL',
  "publishedOn" DATE NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_announcements_orgId_publishedOn_idx"
  ON "school_announcements"("orgId", "publishedOn" DESC);

CREATE TABLE IF NOT EXISTS "discipline_records" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "onDate" DATE NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "severity" "DisciplineSeverity" NOT NULL DEFAULT 'NOTE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discipline_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "discipline_records_orgId_enrollmentId_onDate_idx"
  ON "discipline_records"("orgId", "enrollmentId", "onDate" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_subjects_orgId_fkey') THEN
    ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_class_subjects_orgId_fkey') THEN
    ALTER TABLE "school_class_subjects" ADD CONSTRAINT "school_class_subjects_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_class_subjects_classId_fkey') THEN
    ALTER TABLE "school_class_subjects" ADD CONSTRAINT "school_class_subjects_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_class_subjects_subjectId_fkey') THEN
    ALTER TABLE "school_class_subjects" ADD CONSTRAINT "school_class_subjects_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "school_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_orgId_fkey') THEN
    ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_classId_fkey') THEN
    ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_subjectId_fkey') THEN
    ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_assignments_orgId_fkey') THEN
    ALTER TABLE "school_assignments" ADD CONSTRAINT "school_assignments_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_assignments_classId_fkey') THEN
    ALTER TABLE "school_assignments" ADD CONSTRAINT "school_assignments_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_assignments_subjectId_fkey') THEN
    ALTER TABLE "school_assignments" ADD CONSTRAINT "school_assignments_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_submissions_orgId_fkey') THEN
    ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_submissions_assignmentId_fkey') THEN
    ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "school_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_submissions_enrollmentId_fkey') THEN
    ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_routes_orgId_fkey') THEN
    ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_riders_orgId_fkey') THEN
    ALTER TABLE "transport_riders" ADD CONSTRAINT "transport_riders_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_riders_routeId_fkey') THEN
    ALTER TABLE "transport_riders" ADD CONSTRAINT "transport_riders_routeId_fkey"
      FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_riders_enrollmentId_fkey') THEN
    ALTER TABLE "transport_riders" ADD CONSTRAINT "transport_riders_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hostel_blocks_orgId_fkey') THEN
    ALTER TABLE "hostel_blocks" ADD CONSTRAINT "hostel_blocks_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hostel_rooms_orgId_fkey') THEN
    ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hostel_rooms_blockId_fkey') THEN
    ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_blockId_fkey"
      FOREIGN KEY ("blockId") REFERENCES "hostel_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hostel_allocations_orgId_fkey') THEN
    ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hostel_allocations_roomId_fkey') THEN
    ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hostel_allocations_enrollmentId_fkey') THEN
    ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_announcements_orgId_fkey') THEN
    ALTER TABLE "school_announcements" ADD CONSTRAINT "school_announcements_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discipline_records_orgId_fkey') THEN
    ALTER TABLE "discipline_records" ADD CONSTRAINT "discipline_records_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discipline_records_enrollmentId_fkey') THEN
    ALTER TABLE "discipline_records" ADD CONSTRAINT "discipline_records_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
