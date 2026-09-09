-- School ERP Extended: departments, branches, alumni, certificates, scholarships, etc.

DO $$ BEGIN CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'ALUMNI', 'WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BoardType" AS ENUM ('CBSE', 'ICSE', 'STATE', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CertificateType" AS ENUM ('BONAFIDE', 'TRANSFER_CERTIFICATE', 'CHARACTER', 'FEE_RECEIPT', 'ID_CARD', 'ADMISSION_LETTER', 'REPORT_CARD', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "StudentLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OnlinePaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "admission_number" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "student_status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "previous_school" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "medical_info" JSONB;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "emergency_contact" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "candidates_tenant_id_admission_number_key" ON "candidates"("tenant_id", "admission_number");
CREATE INDEX IF NOT EXISTS "candidates_tenant_id_student_status_idx" ON "candidates"("tenant_id", "student_status");

CREATE TABLE IF NOT EXISTS "departments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "head_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "departments_tenant_id_code_key" ON "departments"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "branches" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "is_main" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "branches_tenant_id_code_key" ON "branches"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "alumni_records" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "graduation_year" INTEGER NOT NULL,
  "last_batch" TEXT,
  "current_occupation" TEXT,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alumni_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "alumni_records_candidate_id_key" ON "alumni_records"("candidate_id");

CREATE TABLE IF NOT EXISTS "student_certificates" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "type" "CertificateType" NOT NULL,
  "title" TEXT NOT NULL,
  "certificate_no" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_until" DATE,
  "data" JSONB,
  "issued_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_certificates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "student_certificates_tenant_id_certificate_no_key" ON "student_certificates"("tenant_id", "certificate_no");

CREATE TABLE IF NOT EXISTS "fee_scholarships" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "discount_type" TEXT NOT NULL DEFAULT 'PERCENT',
  "discount_value" DECIMAL(10,2) NOT NULL,
  "academic_year_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "remarks" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_scholarships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "staff_attendance" (
  "id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "check_in" TEXT,
  "check_out" TEXT,
  "remarks" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_attendance_staff_id_date_key" ON "staff_attendance"("staff_id", "date");

CREATE TABLE IF NOT EXISTS "student_leave_applications" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "reason" TEXT,
  "status" "StudentLeaveStatus" NOT NULL DEFAULT 'PENDING',
  "applicant_id" TEXT,
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_leave_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_promotions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "from_batch_id" TEXT NOT NULL,
  "to_batch_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "promoted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "promoted_by_id" TEXT,
  "remarks" TEXT,
  CONSTRAINT "student_promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grading_board_configs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "board_type" "BoardType" NOT NULL DEFAULT 'CBSE',
  "name" TEXT NOT NULL,
  "grade_rules" JSONB NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "grading_board_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "grading_board_configs_tenant_id_name_key" ON "grading_board_configs"("tenant_id", "name");

CREATE TABLE IF NOT EXISTS "online_payment_orders" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
  "gateway_order_id" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "OnlinePaymentStatus" NOT NULL DEFAULT 'CREATED',
  "paid_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "online_payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contact" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "order_no" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "ordered_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_tenant_id_order_no_key" ON "purchase_orders"("tenant_id", "order_no");

CREATE TABLE IF NOT EXISTS "vehicle_maintenance" (
  "id" TEXT NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "next_due_date" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_maintenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hostel_visitor_passes" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "visitor_name" TEXT NOT NULL,
  "visitor_phone" TEXT,
  "relation" TEXT,
  "visit_date" DATE NOT NULL,
  "visit_time" TEXT,
  "purpose" TEXT,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hostel_visitor_passes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "substitute_assignments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "timetable_slot_id" TEXT NOT NULL,
  "original_teacher_id" TEXT NOT NULL,
  "substitute_teacher_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "substitute_assignments_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (idempotent)
DO $$ BEGIN ALTER TABLE "candidates" ADD CONSTRAINT "candidates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "departments" ADD CONSTRAINT "departments_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
