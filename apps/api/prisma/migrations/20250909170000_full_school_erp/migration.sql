-- Full School ERP migration (idempotent enums)

DO $$ BEGIN CREATE TYPE "AcademicYearStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CalendarEventType" AS ENUM ('HOLIDAY', 'EXAM', 'EVENT', 'MEETING', 'TERM_START', 'TERM_END'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AdmissionEnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'VISITED', 'CONVERTED', 'REJECTED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AdmissionApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'APPROVED', 'REJECTED', 'ENROLLED', 'WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FeeInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'WAIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'CARD', 'ONLINE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'PUBLISHED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LibraryIssueStatus" AS ENUM ('ISSUED', 'RETURNED', 'OVERDUE', 'LOST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HostelRoomType" AS ENUM ('SINGLE', 'DOUBLE', 'DORMITORY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InventoryTransactionType" AS ENUM ('PURCHASE', 'ISSUE', 'RETURN', 'ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DisciplineSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "academic_years" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "status" "AcademicYearStatus" NOT NULL DEFAULT 'UPCOMING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "academic_year_id" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "event_type" "CalendarEventType" NOT NULL DEFAULT 'EVENT',
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "is_holiday" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "admission_enquiries" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "student_name" TEXT NOT NULL,
  "parent_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "class_applied" TEXT NOT NULL,
  "source" TEXT,
  "notes" TEXT,
  "status" "AdmissionEnquiryStatus" NOT NULL DEFAULT 'NEW',
  "handled_by_id" TEXT,
  "follow_up_date" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_enquiries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "admission_applications" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "enquiry_id" TEXT,
  "application_no" TEXT NOT NULL,
  "student_name" TEXT NOT NULL,
  "date_of_birth" DATE,
  "gender" TEXT,
  "parent_name" TEXT NOT NULL,
  "parent_phone" TEXT NOT NULL,
  "parent_email" TEXT,
  "address" TEXT,
  "class_applied" TEXT NOT NULL,
  "previous_school" TEXT,
  "academic_year_id" TEXT,
  "documents" JSONB,
  "interview_date" TIMESTAMP(3),
  "status" "AdmissionApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "remarks" TEXT,
  "candidate_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_heads" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_heads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_structures" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "batch_id" TEXT,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_structure_lines" (
  "id" TEXT NOT NULL,
  "fee_structure_id" TEXT NOT NULL,
  "fee_head_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "due_date" DATE,
  CONSTRAINT "fee_structure_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_invoices" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "invoice_no" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "fee_structure_id" TEXT,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "due_date" DATE NOT NULL,
  "status" "FeeInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "remarks" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_payments" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "FeePaymentMethod" NOT NULL DEFAULT 'CASH',
  "reference_no" TEXT,
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recorded_by_id" TEXT,
  "receipt_no" TEXT,
  "remarks" TEXT,
  CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "academic_terms" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "term_number" INTEGER NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grade_entries" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "term_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "max_marks" DECIMAL(6,2) NOT NULL DEFAULT 100,
  "marks_obtained" DECIMAL(6,2) NOT NULL,
  "grade" TEXT,
  "remarks" TEXT,
  "entered_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "grade_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "report_cards" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "term_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "total_marks" DECIMAL(8,2) NOT NULL,
  "max_marks" DECIMAL(8,2) NOT NULL,
  "percentage" DECIMAL(5,2) NOT NULL,
  "overall_grade" TEXT NOT NULL,
  "rank" INTEGER,
  "attendance_pct" DECIMAL(5,2),
  "remarks" TEXT,
  "status" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT',
  "issued_by_id" TEXT,
  "issued_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "start_point" TEXT NOT NULL,
  "end_point" TEXT NOT NULL,
  "monthly_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transport_stops" (
  "id" TEXT NOT NULL,
  "route_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "pick_up_time" TEXT,
  CONSTRAINT "transport_stops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transport_vehicles" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "route_id" TEXT,
  "registration" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 40,
  "driver_name" TEXT,
  "driver_phone" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transport_assignments" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "route_id" TEXT NOT NULL,
  "stop_id" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  CONSTRAINT "transport_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "library_books" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "isbn" TEXT,
  "category" TEXT,
  "total_copies" INTEGER NOT NULL DEFAULT 1,
  "available" INTEGER NOT NULL DEFAULT 1,
  "shelf_location" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "library_issues" (
  "id" TEXT NOT NULL,
  "book_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_date" DATE NOT NULL,
  "returned_at" TIMESTAMP(3),
  "fine_amount" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "status" "LibraryIssueStatus" NOT NULL DEFAULT 'ISSUED',
  "issued_by_id" TEXT,
  "returned_by_id" TEXT,
  CONSTRAINT "library_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "staff_profiles" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "department" TEXT,
  "designation" TEXT,
  "joining_date" DATE NOT NULL,
  "basic_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "bank_account" TEXT,
  "emergency_contact" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "leave_applications" (
  "id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "leave_type" "LeaveType" NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "reason" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "applicant_id" TEXT NOT NULL,
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "salary_slips" (
  "id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "basic_salary" DECIMAL(12,2) NOT NULL,
  "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "net_salary" DECIMAL(12,2) NOT NULL,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "salary_slips_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hostels" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "warden_name" TEXT,
  "warden_phone" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hostels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hostel_rooms" (
  "id" TEXT NOT NULL,
  "hostel_id" TEXT NOT NULL,
  "room_number" TEXT NOT NULL,
  "room_type" "HostelRoomType" NOT NULL DEFAULT 'DOUBLE',
  "capacity" INTEGER NOT NULL DEFAULT 2,
  "occupied" INTEGER NOT NULL DEFAULT 0,
  "monthly_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT "hostel_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hostel_allocations" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "bed_number" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  CONSTRAINT "hostel_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_items" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "category" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL DEFAULT 'pcs',
  "reorder_level" INTEGER NOT NULL DEFAULT 5,
  "unit_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_transactions" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "type" "InventoryTransactionType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reference" TEXT,
  "remarks" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notification_logs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "recipient" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "sent_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "discipline_records" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "incident_date" DATE NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "DisciplineSeverity" NOT NULL DEFAULT 'LOW',
  "action_taken" TEXT,
  "recorded_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discipline_records_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_tenant_id_name_key" ON "academic_years"("tenant_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "admission_applications_enquiry_id_key" ON "admission_applications"("enquiry_id");
CREATE UNIQUE INDEX IF NOT EXISTS "admission_applications_candidate_id_key" ON "admission_applications"("candidate_id");
CREATE UNIQUE INDEX IF NOT EXISTS "admission_applications_tenant_id_application_no_key" ON "admission_applications"("tenant_id", "application_no");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_heads_tenant_id_code_key" ON "fee_heads"("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_structure_lines_fee_structure_id_fee_head_id_key" ON "fee_structure_lines"("fee_structure_id", "fee_head_id");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_invoices_tenant_id_invoice_no_key" ON "fee_invoices"("tenant_id", "invoice_no");
CREATE UNIQUE INDEX IF NOT EXISTS "academic_terms_academic_year_id_term_number_key" ON "academic_terms"("academic_year_id", "term_number");
CREATE UNIQUE INDEX IF NOT EXISTS "grade_entries_term_id_candidate_id_subject_id_key" ON "grade_entries"("term_id", "candidate_id", "subject_id");
CREATE UNIQUE INDEX IF NOT EXISTS "report_cards_term_id_candidate_id_key" ON "report_cards"("term_id", "candidate_id");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_routes_tenant_id_code_key" ON "transport_routes"("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_stops_route_id_sequence_key" ON "transport_stops"("route_id", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_vehicles_tenant_id_registration_key" ON "transport_vehicles"("tenant_id", "registration");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_assignments_candidate_id_key" ON "transport_assignments"("candidate_id");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_user_id_key" ON "staff_profiles"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_tenant_id_employee_id_key" ON "staff_profiles"("tenant_id", "employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "salary_slips_staff_id_month_year_key" ON "salary_slips"("staff_id", "month", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "hostels_tenant_id_name_key" ON "hostels"("tenant_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_rooms_hostel_id_room_number_key" ON "hostel_rooms"("hostel_id", "room_number");
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_allocations_candidate_id_key" ON "hostel_allocations"("candidate_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_id_sku_key" ON "inventory_items"("tenant_id", "sku");

-- Foreign keys (idempotent)
DO $$ BEGIN
  ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "grade_entries" ADD CONSTRAINT "grade_entries_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
