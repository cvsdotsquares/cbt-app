-- CreateEnum
DO $$ BEGIN CREATE TYPE "LiveClassProvider" AS ENUM ('JITSI', 'ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LiveClassStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "live_classes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "provider" "LiveClassProvider" NOT NULL DEFAULT 'JITSI',
    "meeting_url" TEXT NOT NULL,
    "recording_url" TEXT,
    "status" "LiveClassStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "live_class_joins" (
    "id" TEXT NOT NULL,
    "live_class_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "candidate_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "live_class_joins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "live_classes_tenant_id_batch_id_start_time_idx" ON "live_classes"("tenant_id", "batch_id", "start_time");
CREATE INDEX IF NOT EXISTS "live_classes_tenant_id_status_start_time_idx" ON "live_classes"("tenant_id", "status", "start_time");
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_joins_live_class_id_user_id_key" ON "live_class_joins"("live_class_id", "user_id");
CREATE INDEX IF NOT EXISTS "live_class_joins_live_class_id_idx" ON "live_class_joins"("live_class_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "live_class_joins" ADD CONSTRAINT "live_class_joins_live_class_id_fkey" FOREIGN KEY ("live_class_id") REFERENCES "live_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "live_class_joins" ADD CONSTRAINT "live_class_joins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "live_class_joins" ADD CONSTRAINT "live_class_joins_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
