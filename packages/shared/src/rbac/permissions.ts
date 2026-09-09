export enum Permission {
  // Users
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_ASSIGN_ROLE = 'user:assign_role',
  SESSION_MANAGE = 'session:manage',
  MFA_MANAGE = 'mfa:manage',

  // Tenants
  TENANT_CREATE = 'tenant:create',
  TENANT_READ = 'tenant:read',
  TENANT_UPDATE = 'tenant:update',
  TENANT_DELETE = 'tenant:delete',
  TENANT_BRANDING = 'tenant:branding',
  TENANT_SECURITY_CONFIG = 'tenant:security_config',

  // Candidates
  CANDIDATE_CREATE = 'candidate:create',
  CANDIDATE_READ = 'candidate:read',
  CANDIDATE_UPDATE = 'candidate:update',
  CANDIDATE_DELETE = 'candidate:delete',
  CANDIDATE_KYC_VERIFY = 'candidate:kyc_verify',
  CANDIDATE_BULK_IMPORT = 'candidate:bulk_import',
  CANDIDATE_ADMIT_CARD = 'candidate:admit_card',

  // Questions
  QUESTION_CREATE = 'question:create',
  QUESTION_READ = 'question:read',
  QUESTION_UPDATE = 'question:update',
  QUESTION_DELETE = 'question:delete',
  QUESTION_APPROVE = 'question:approve',
  QUESTION_IMPORT = 'question:import',
  QUESTION_EXPORT = 'question:export',
  QUESTION_VERSION = 'question:version',

  // Exams
  EXAM_CREATE = 'exam:create',
  EXAM_READ = 'exam:read',
  EXAM_UPDATE = 'exam:update',
  EXAM_DELETE = 'exam:delete',
  EXAM_PUBLISH = 'exam:publish',
  EXAM_SCHEDULE = 'exam:schedule',
  EXAM_ASSIGN_CANDIDATES = 'exam:assign_candidates',
  EXAM_TEMPLATE = 'exam:template',
  EXAM_TAKE = 'exam:take',
  EXAM_SUBMIT = 'exam:submit',
  EXAM_RESUME = 'exam:resume',
  EXAM_VIEW_RESPONSE = 'exam:view_response',

  // Proctoring
  PROCTORING_MONITOR = 'proctoring:monitor',
  PROCTORING_INTERVENE = 'proctoring:intervene',
  PROCTORING_TERMINATE = 'proctoring:terminate_session',
  PROCTORING_VIEW_RECORDINGS = 'proctoring:view_recordings',
  PROCTORING_MANAGE_ALERTS = 'proctoring:manage_alerts',

  // Security
  SECURITY_VIEW_VIOLATIONS = 'security:view_violations',
  SECURITY_CONFIGURE = 'security:configure',
  SECURITY_IP_RESTRICT = 'security:ip_restrict',
  SECURITY_GEOFENCE = 'security:geofence',

  // Coding
  CODING_CREATE = 'coding:create',
  CODING_EXECUTE = 'coding:execute',
  CODING_VIEW_SUBMISSIONS = 'coding:view_submissions',
  CODING_PLAGIARISM_CHECK = 'coding:plagiarism_check',

  // Results
  RESULT_EVALUATE = 'result:evaluate',
  RESULT_PUBLISH = 'result:publish',
  RESULT_READ = 'result:read',
  RESULT_RANK = 'result:rank',
  RESULT_CUTOFF = 'result:cutoff',
  RESULT_CERTIFICATE = 'result:certificate',

  // Analytics & Audit
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',

  // Curriculum & Learning
  CURRICULUM_MANAGE = 'curriculum:manage',
  CURRICULUM_READ = 'curriculum:read',
  BATCH_MANAGE = 'batch:manage',
  BATCH_READ = 'batch:read',
  SYLLABUS_MANAGE = 'syllabus:manage',
  SYLLABUS_READ = 'syllabus:read',
  MATERIAL_UPLOAD = 'material:upload',
  MATERIAL_READ = 'material:read',
  MATERIAL_DELETE = 'material:delete',
  AI_GENERATE_TEST = 'ai:generate_test',
  LEARNING_READ = 'learning:read',
  LEARNING_MANAGE = 'learning:manage',

  // School operations
  TIMETABLE_READ = 'timetable:read',
  TIMETABLE_MANAGE = 'timetable:manage',
  ATTENDANCE_READ = 'attendance:read',
  ATTENDANCE_MANAGE = 'attendance:manage',
  HOMEWORK_READ = 'homework:read',
  HOMEWORK_MANAGE = 'homework:manage',
  HOMEWORK_SUBMIT = 'homework:submit',
  NOTICE_READ = 'notice:read',
  NOTICE_MANAGE = 'notice:manage',
  PARENT_READ = 'parent:read',
  LIVE_CLASS_READ = 'live_class:read',
  LIVE_CLASS_MANAGE = 'live_class:manage',
  LIVE_CLASS_JOIN = 'live_class:join',

  // School ERP — Admissions & Academic
  ADMISSION_READ = 'admission:read',
  ADMISSION_MANAGE = 'admission:manage',
  ACADEMIC_YEAR_READ = 'academic_year:read',
  ACADEMIC_YEAR_MANAGE = 'academic_year:manage',
  CALENDAR_READ = 'calendar:read',
  CALENDAR_MANAGE = 'calendar:manage',
  REPORT_CARD_READ = 'report_card:read',
  REPORT_CARD_MANAGE = 'report_card:manage',

  // Fees
  FEE_READ = 'fee:read',
  FEE_MANAGE = 'fee:manage',
  FEE_COLLECT = 'fee:collect',

  // Transport, Library, Hostel
  TRANSPORT_READ = 'transport:read',
  TRANSPORT_MANAGE = 'transport:manage',
  LIBRARY_READ = 'library:read',
  LIBRARY_MANAGE = 'library:manage',
  HOSTEL_READ = 'hostel:read',
  HOSTEL_MANAGE = 'hostel:manage',

  // HR & Inventory
  HR_READ = 'hr:read',
  HR_MANAGE = 'hr:manage',
  INVENTORY_READ = 'inventory:read',
  INVENTORY_MANAGE = 'inventory:manage',

  // Communications & Discipline
  NOTIFICATION_READ = 'notification:read',
  NOTIFICATION_SEND = 'notification:send',
  DISCIPLINE_READ = 'discipline:read',
  DISCIPLINE_MANAGE = 'discipline:manage',

  // Extended ERP
  DEPARTMENT_READ = 'department:read',
  DEPARTMENT_MANAGE = 'department:manage',
  BRANCH_READ = 'branch:read',
  BRANCH_MANAGE = 'branch:manage',
  CERTIFICATE_READ = 'certificate:read',
  CERTIFICATE_MANAGE = 'certificate:manage',
  ALUMNI_READ = 'alumni:read',
  ALUMNI_MANAGE = 'alumni:manage',
  STUDENT_LEAVE_READ = 'student_leave:read',
  STUDENT_LEAVE_MANAGE = 'student_leave:manage',
  PROMOTION_MANAGE = 'promotion:manage',
  PAYMENT_ONLINE = 'payment:online',
}
