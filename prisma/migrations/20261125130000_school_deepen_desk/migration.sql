-- School deepen desk 48d: campus, admissions, student profile, teacher Employee,
-- subject grades, exams, homework files, installments, fee add-ons, notify flags.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdmissionStatus') THEN
    CREATE TYPE "AdmissionStatus" AS ENUM ('APPLIED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'ENROLLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school_campuses" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_campuses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_campuses_orgId_name_key" ON "school_campuses"("orgId", "name");
CREATE INDEX IF NOT EXISTS "school_campuses_orgId_isActive_idx" ON "school_campuses"("orgId", "isActive");

ALTER TABLE "fee_plans" ADD COLUMN IF NOT EXISTS "installmentCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "billingCustomerId" TEXT;
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "campusId" TEXT;
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "admissionNumber" TEXT;
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE;
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "guardianName" TEXT;
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "guardianPhone" TEXT;
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "student_enrollments_orgId_admissionNumber_key"
  ON "student_enrollments"("orgId", "admissionNumber");
CREATE INDEX IF NOT EXISTS "student_enrollments_billingCustomerId_idx"
  ON "student_enrollments"("billingCustomerId");
CREATE INDEX IF NOT EXISTS "student_enrollments_campusId_idx"
  ON "student_enrollments"("campusId");

CREATE TABLE IF NOT EXISTS "school_admissions" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "applicantName" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "programId" TEXT,
  "termId" TEXT,
  "feePlanId" TEXT,
  "customerId" TEXT,
  "status" "AdmissionStatus" NOT NULL DEFAULT 'APPLIED',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_admissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_admissions_orgId_status_createdAt_idx"
  ON "school_admissions"("orgId", "status", "createdAt" DESC);

ALTER TABLE "school_classes" ADD COLUMN IF NOT EXISTS "campusId" TEXT;
ALTER TABLE "school_classes" ADD COLUMN IF NOT EXISTS "teacherEmployeeId" TEXT;
CREATE INDEX IF NOT EXISTS "school_classes_campusId_idx" ON "school_classes"("campusId");
CREATE INDEX IF NOT EXISTS "school_classes_teacherEmployeeId_idx" ON "school_classes"("teacherEmployeeId");

ALTER TABLE "grade_items" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
CREATE INDEX IF NOT EXISTS "grade_items_subjectId_idx" ON "grade_items"("subjectId");

ALTER TABLE "school_class_subjects" ADD COLUMN IF NOT EXISTS "teacherEmployeeId" TEXT;
CREATE INDEX IF NOT EXISTS "school_class_subjects_teacherEmployeeId_idx"
  ON "school_class_subjects"("teacherEmployeeId");

ALTER TABLE "timetable_slots" ADD COLUMN IF NOT EXISTS "teacherEmployeeId" TEXT;
CREATE INDEX IF NOT EXISTS "timetable_slots_orgId_teacherEmployeeId_dayOfWeek_idx"
  ON "timetable_slots"("orgId", "teacherEmployeeId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "timetable_slots_orgId_room_dayOfWeek_idx"
  ON "timetable_slots"("orgId", "room", "dayOfWeek");

ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "portalNote" TEXT;

CREATE TABLE IF NOT EXISTS "school_exams" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_exams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_exams_orgId_termId_classId_idx"
  ON "school_exams"("orgId", "termId", "classId");

CREATE TABLE IF NOT EXISTS "school_exam_slots" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "onDate" DATE NOT NULL,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "room" TEXT,
  "invigilatorName" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_exam_slots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_exam_slots_orgId_examId_onDate_idx"
  ON "school_exam_slots"("orgId", "examId", "onDate");
CREATE INDEX IF NOT EXISTS "school_exam_slots_classId_onDate_idx"
  ON "school_exam_slots"("classId", "onDate");

ALTER TABLE "transport_routes" ADD COLUMN IF NOT EXISTS "campusId" TEXT;
ALTER TABLE "transport_routes" ADD COLUMN IF NOT EXISTS "feeItemId" TEXT;
CREATE INDEX IF NOT EXISTS "transport_routes_campusId_idx" ON "transport_routes"("campusId");
CREATE INDEX IF NOT EXISTS "transport_routes_feeItemId_idx" ON "transport_routes"("feeItemId");

ALTER TABLE "hostel_blocks" ADD COLUMN IF NOT EXISTS "campusId" TEXT;
ALTER TABLE "hostel_blocks" ADD COLUMN IF NOT EXISTS "feeItemId" TEXT;
CREATE INDEX IF NOT EXISTS "hostel_blocks_campusId_idx" ON "hostel_blocks"("campusId");
CREATE INDEX IF NOT EXISTS "hostel_blocks_feeItemId_idx" ON "hostel_blocks"("feeItemId");

ALTER TABLE "hostel_rooms" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "hostel_allocations" ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMPTZ(6);

-- Allow re-allocate after checkout: drop hard unique on enrollmentId.
ALTER TABLE "hostel_allocations" DROP CONSTRAINT IF EXISTS "hostel_allocations_enrollmentId_key";
DROP INDEX IF EXISTS "hostel_allocations_enrollmentId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_allocations_active_enrollment_uidx"
  ON "hostel_allocations"("enrollmentId") WHERE "checkedOutAt" IS NULL;
CREATE INDEX IF NOT EXISTS "hostel_allocations_enrollmentId_idx" ON "hostel_allocations"("enrollmentId");

ALTER TABLE "school_announcements" ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "school_announcements" ADD COLUMN IF NOT EXISTS "notifyParents" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "school_announcements_classId_idx" ON "school_announcements"("classId");

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_campuses_orgId_fkey') THEN
    ALTER TABLE "school_campuses" ADD CONSTRAINT "school_campuses_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_billingCustomerId_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_billingCustomerId_fkey"
      FOREIGN KEY ("billingCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_campusId_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "school_campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_admissions_orgId_fkey') THEN
    ALTER TABLE "school_admissions" ADD CONSTRAINT "school_admissions_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_admissions_programId_fkey') THEN
    ALTER TABLE "school_admissions" ADD CONSTRAINT "school_admissions_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "academic_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_admissions_termId_fkey') THEN
    ALTER TABLE "school_admissions" ADD CONSTRAINT "school_admissions_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_admissions_feePlanId_fkey') THEN
    ALTER TABLE "school_admissions" ADD CONSTRAINT "school_admissions_feePlanId_fkey"
      FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_admissions_customerId_fkey') THEN
    ALTER TABLE "school_admissions" ADD CONSTRAINT "school_admissions_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_classes_campusId_fkey') THEN
    ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "school_campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_classes_teacherEmployeeId_fkey') THEN
    ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_teacherEmployeeId_fkey"
      FOREIGN KEY ("teacherEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_items_subjectId_fkey') THEN
    ALTER TABLE "grade_items" ADD CONSTRAINT "grade_items_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_class_subjects_teacherEmployeeId_fkey') THEN
    ALTER TABLE "school_class_subjects" ADD CONSTRAINT "school_class_subjects_teacherEmployeeId_fkey"
      FOREIGN KEY ("teacherEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_teacherEmployeeId_fkey') THEN
    ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacherEmployeeId_fkey"
      FOREIGN KEY ("teacherEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_exams_orgId_fkey') THEN
    ALTER TABLE "school_exams" ADD CONSTRAINT "school_exams_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_exams_termId_fkey') THEN
    ALTER TABLE "school_exams" ADD CONSTRAINT "school_exams_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_exams_classId_fkey') THEN
    ALTER TABLE "school_exams" ADD CONSTRAINT "school_exams_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_exam_slots_orgId_fkey') THEN
    ALTER TABLE "school_exam_slots" ADD CONSTRAINT "school_exam_slots_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_exam_slots_examId_fkey') THEN
    ALTER TABLE "school_exam_slots" ADD CONSTRAINT "school_exam_slots_examId_fkey"
      FOREIGN KEY ("examId") REFERENCES "school_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_exam_slots_classId_fkey') THEN
    ALTER TABLE "school_exam_slots" ADD CONSTRAINT "school_exam_slots_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_exam_slots_subjectId_fkey') THEN
    ALTER TABLE "school_exam_slots" ADD CONSTRAINT "school_exam_slots_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_routes_campusId_fkey') THEN
    ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "school_campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_routes_feeItemId_fkey') THEN
    ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_feeItemId_fkey"
      FOREIGN KEY ("feeItemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hostel_blocks_campusId_fkey') THEN
    ALTER TABLE "hostel_blocks" ADD CONSTRAINT "hostel_blocks_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "school_campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hostel_blocks_feeItemId_fkey') THEN
    ALTER TABLE "hostel_blocks" ADD CONSTRAINT "hostel_blocks_feeItemId_fkey"
      FOREIGN KEY ("feeItemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_announcements_classId_fkey') THEN
    ALTER TABLE "school_announcements" ADD CONSTRAINT "school_announcements_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
