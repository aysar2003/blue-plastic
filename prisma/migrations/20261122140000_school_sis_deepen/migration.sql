-- School SIS deepen: classes, roster, attendance, grades (not LMS).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceMark') THEN
    CREATE TYPE "AttendanceMark" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school_classes" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "teacherName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_classes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_classes_orgId_termId_name_key"
  ON "school_classes"("orgId", "termId", "name");
CREATE INDEX IF NOT EXISTS "school_classes_orgId_isActive_termId_idx"
  ON "school_classes"("orgId", "isActive", "termId");
CREATE INDEX IF NOT EXISTS "school_classes_programId_idx" ON "school_classes"("programId");

CREATE TABLE IF NOT EXISTS "school_class_members" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_class_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_class_members_classId_enrollmentId_key"
  ON "school_class_members"("classId", "enrollmentId");
CREATE INDEX IF NOT EXISTS "school_class_members_orgId_classId_idx"
  ON "school_class_members"("orgId", "classId");
CREATE INDEX IF NOT EXISTS "school_class_members_enrollmentId_idx"
  ON "school_class_members"("enrollmentId");

CREATE TABLE IF NOT EXISTS "student_attendance_days" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "onDate" DATE NOT NULL,
  "mark" "AttendanceMark" NOT NULL DEFAULT 'PRESENT',
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_attendance_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_attendance_days_classId_enrollmentId_onDate_key"
  ON "student_attendance_days"("classId", "enrollmentId", "onDate");
CREATE INDEX IF NOT EXISTS "student_attendance_days_orgId_classId_onDate_idx"
  ON "student_attendance_days"("orgId", "classId", "onDate");
CREATE INDEX IF NOT EXISTS "student_attendance_days_enrollmentId_onDate_idx"
  ON "student_attendance_days"("enrollmentId", "onDate");

CREATE TABLE IF NOT EXISTS "grade_items" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "maxScore" DECIMAL(19,4) NOT NULL DEFAULT 100,
  "weightPercent" DECIMAL(7,4) NOT NULL DEFAULT 100,
  "dueOn" DATE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grade_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "grade_items_classId_name_key" ON "grade_items"("classId", "name");
CREATE INDEX IF NOT EXISTS "grade_items_orgId_classId_idx" ON "grade_items"("orgId", "classId");

CREATE TABLE IF NOT EXISTS "grade_entries" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "gradeItemId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "score" DECIMAL(19,4) NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grade_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "grade_entries_gradeItemId_enrollmentId_key"
  ON "grade_entries"("gradeItemId", "enrollmentId");
CREATE INDEX IF NOT EXISTS "grade_entries_orgId_enrollmentId_idx"
  ON "grade_entries"("orgId", "enrollmentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_classes_orgId_fkey') THEN
    ALTER TABLE "school_classes"
      ADD CONSTRAINT "school_classes_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_classes_programId_fkey') THEN
    ALTER TABLE "school_classes"
      ADD CONSTRAINT "school_classes_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "academic_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_classes_termId_fkey') THEN
    ALTER TABLE "school_classes"
      ADD CONSTRAINT "school_classes_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_class_members_orgId_fkey') THEN
    ALTER TABLE "school_class_members"
      ADD CONSTRAINT "school_class_members_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_class_members_classId_fkey') THEN
    ALTER TABLE "school_class_members"
      ADD CONSTRAINT "school_class_members_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_class_members_enrollmentId_fkey') THEN
    ALTER TABLE "school_class_members"
      ADD CONSTRAINT "school_class_members_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_attendance_days_orgId_fkey') THEN
    ALTER TABLE "student_attendance_days"
      ADD CONSTRAINT "student_attendance_days_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_attendance_days_classId_fkey') THEN
    ALTER TABLE "student_attendance_days"
      ADD CONSTRAINT "student_attendance_days_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_attendance_days_enrollmentId_fkey') THEN
    ALTER TABLE "student_attendance_days"
      ADD CONSTRAINT "student_attendance_days_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_items_orgId_fkey') THEN
    ALTER TABLE "grade_items"
      ADD CONSTRAINT "grade_items_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_items_classId_fkey') THEN
    ALTER TABLE "grade_items"
      ADD CONSTRAINT "grade_items_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_entries_orgId_fkey') THEN
    ALTER TABLE "grade_entries"
      ADD CONSTRAINT "grade_entries_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_entries_gradeItemId_fkey') THEN
    ALTER TABLE "grade_entries"
      ADD CONSTRAINT "grade_entries_gradeItemId_fkey"
      FOREIGN KEY ("gradeItemId") REFERENCES "grade_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_entries_enrollmentId_fkey') THEN
    ALTER TABLE "grade_entries"
      ADD CONSTRAINT "grade_entries_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
