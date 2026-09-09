-- CreateEnum (idempotent)
DO $$ BEGIN CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HALF_DAY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE', 'GRADED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NoticeTarget" AS ENUM ('ALL', 'BATCH', 'ACADEMIC_CLASS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "period_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "timetable_slots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT,
    "day_of_week" "DayOfWeek" NOT NULL,
    "period_number" INTEGER NOT NULL,
    "room" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "marked_by_id" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "homeworks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homeworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "homework_submissions" (
    "id" TEXT NOT NULL,
    "homework_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "content" TEXT,
    "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "grade" TEXT,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "target_type" "NoticeTarget" NOT NULL DEFAULT 'ALL',
    "target_id" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "parent_student_links" (
    "id" TEXT NOT NULL,
    "parent_user_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'Parent',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_student_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "period_configs_tenant_id_period_number_key" ON "period_configs"("tenant_id", "period_number");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_batch_id_day_of_week_period_number_key" ON "timetable_slots"("batch_id", "day_of_week", "period_number");

-- CreateIndex
CREATE INDEX "timetable_slots_tenant_id_batch_id_idx" ON "timetable_slots"("tenant_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_batch_id_candidate_id_date_key" ON "attendance_records"("batch_id", "candidate_id", "date");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_batch_id_date_idx" ON "attendance_records"("tenant_id", "batch_id", "date");

-- CreateIndex
CREATE INDEX "attendance_records_candidate_id_date_idx" ON "attendance_records"("candidate_id", "date");

-- CreateIndex
CREATE INDEX "homeworks_tenant_id_batch_id_idx" ON "homeworks"("tenant_id", "batch_id");

-- CreateIndex
CREATE INDEX "homeworks_due_date_idx" ON "homeworks"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "homework_submissions_homework_id_candidate_id_key" ON "homework_submissions"("homework_id", "candidate_id");

-- CreateIndex
CREATE INDEX "notices_tenant_id_is_published_created_at_idx" ON "notices"("tenant_id", "is_published", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "parent_student_links_parent_user_id_candidate_id_key" ON "parent_student_links"("parent_user_id", "candidate_id");

-- AddForeignKey
ALTER TABLE "period_configs" ADD CONSTRAINT "period_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homeworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
