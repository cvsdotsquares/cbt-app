import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Permission, type JwtPayload } from '@cbt/shared';
import { SchoolErpService } from './school-erp.service';
import { SchoolErpExtendedService } from './school-erp-extended.service';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('School ERP')
@Controller('school-erp')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SchoolErpController {
  constructor(
    private erp: SchoolErpService,
    private extended: SchoolErpExtendedService,
    private documents: DocumentsService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(Permission.ANALYTICS_VIEW)
  dashboard(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.getErpDashboard(tenantId);
  }

  // Academic Year & Calendar
  @Get('academic-years')
  @RequirePermissions(Permission.ACADEMIC_YEAR_READ)
  listAcademicYears(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listAcademicYears(tenantId);
  }

  @Post('academic-years')
  @RequirePermissions(Permission.ACADEMIC_YEAR_MANAGE)
  createAcademicYear(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createAcademicYear(tenantId, body as never);
  }

  @Get('calendar')
  @RequirePermissions(Permission.CALENDAR_READ)
  listCalendar(@CurrentUser('tenantId') tenantId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.erp.listCalendarEvents(tenantId, from, to);
  }

  @Post('calendar')
  @RequirePermissions(Permission.CALENDAR_MANAGE)
  createCalendarEvent(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createCalendarEvent(tenantId, body as never);
  }

  // Admissions
  @Get('admissions/enquiries')
  @RequirePermissions(Permission.ADMISSION_READ)
  listEnquiries(@CurrentUser('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.erp.listEnquiries(tenantId, status);
  }

  @Post('admissions/enquiries')
  @RequirePermissions(Permission.ADMISSION_MANAGE)
  createEnquiry(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, string>) {
    return this.erp.createEnquiry(tenantId, body);
  }

  @Patch('admissions/enquiries/:id/status')
  @RequirePermissions(Permission.ADMISSION_MANAGE)
  updateEnquiryStatus(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() body: { status: string }) {
    return this.erp.updateEnquiryStatus(tenantId, id, body.status as never);
  }

  @Get('admissions/applications')
  @RequirePermissions(Permission.ADMISSION_READ)
  listApplications(@CurrentUser('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.erp.listApplications(tenantId, status);
  }

  @Post('admissions/applications')
  @RequirePermissions(Permission.ADMISSION_MANAGE)
  createApplication(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createApplication(tenantId, body);
  }

  @Patch('admissions/applications/:id/status')
  @RequirePermissions(Permission.ADMISSION_MANAGE)
  updateApplicationStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: { status: string; remarks?: string },
  ) {
    return this.erp.updateApplicationStatus(tenantId, id, body.status as never, body.remarks);
  }

  // Fees
  @Get('fees/summary')
  @RequirePermissions(Permission.FEE_READ)
  feeSummary(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.getFeeSummary(tenantId);
  }

  @Get('fees/heads')
  @RequirePermissions(Permission.FEE_READ)
  listFeeHeads(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listFeeHeads(tenantId);
  }

  @Post('fees/heads')
  @RequirePermissions(Permission.FEE_MANAGE)
  createFeeHead(@CurrentUser('tenantId') tenantId: string, @Body() body: { name: string; code: string; description?: string }) {
    return this.erp.createFeeHead(tenantId, body);
  }

  @Get('fees/structures')
  @RequirePermissions(Permission.FEE_READ)
  listFeeStructures(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listFeeStructures(tenantId);
  }

  @Post('fees/structures')
  @RequirePermissions(Permission.FEE_MANAGE)
  createFeeStructure(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createFeeStructure(tenantId, body as never);
  }

  @Get('fees/invoices')
  @RequirePermissions(Permission.FEE_READ)
  listInvoices(@CurrentUser('tenantId') tenantId: string, @Query('candidateId') candidateId?: string) {
    return this.erp.listFeeInvoices(tenantId, candidateId);
  }

  @Post('fees/invoices')
  @RequirePermissions(Permission.FEE_MANAGE)
  createInvoice(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createFeeInvoice(tenantId, body as never);
  }

  @Post('fees/payments')
  @RequirePermissions(Permission.FEE_COLLECT)
  recordPayment(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.erp.recordFeePayment(user.tenantId, user.sub, body as never);
  }

  // Report Cards
  @Get('terms')
  @RequirePermissions(Permission.REPORT_CARD_READ)
  listTerms(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listTerms(tenantId);
  }

  @Post('terms')
  @RequirePermissions(Permission.REPORT_CARD_MANAGE)
  createTerm(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createTerm(tenantId, body as never);
  }

  @Get('grades')
  @RequirePermissions(Permission.REPORT_CARD_READ)
  listGrades(@CurrentUser('tenantId') tenantId: string, @Query('termId') termId: string, @Query('candidateId') candidateId?: string) {
    return this.erp.listGradeEntries(tenantId, termId, candidateId);
  }

  @Post('grades')
  @RequirePermissions(Permission.REPORT_CARD_MANAGE)
  upsertGrade(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.erp.upsertGradeEntry(user.tenantId, user.sub, body as never);
  }

  @Get('report-cards')
  @RequirePermissions(Permission.REPORT_CARD_READ)
  listReportCards(@CurrentUser('tenantId') tenantId: string, @Query('candidateId') candidateId?: string) {
    return this.erp.listReportCards(tenantId, candidateId);
  }

  @Post('report-cards/generate')
  @RequirePermissions(Permission.REPORT_CARD_MANAGE)
  generateReportCard(@CurrentUser() user: JwtPayload, @Body() body: { termId: string; candidateId: string }) {
    return this.erp.generateReportCard(user.tenantId, user.sub, body.termId, body.candidateId);
  }

  // Transport
  @Get('transport/routes')
  @RequirePermissions(Permission.TRANSPORT_READ)
  listRoutes(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listTransportRoutes(tenantId);
  }

  @Post('transport/routes')
  @RequirePermissions(Permission.TRANSPORT_MANAGE)
  createRoute(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createTransportRoute(tenantId, body as never);
  }

  @Post('transport/assign')
  @RequirePermissions(Permission.TRANSPORT_MANAGE)
  assignTransport(@Body() body: Record<string, unknown>) {
    return this.erp.assignTransport(body as never);
  }

  // Library
  @Get('library/books')
  @RequirePermissions(Permission.LIBRARY_READ)
  listBooks(@CurrentUser('tenantId') tenantId: string, @Query('search') search?: string) {
    return this.erp.listLibraryBooks(tenantId, search);
  }

  @Post('library/books')
  @RequirePermissions(Permission.LIBRARY_MANAGE)
  createBook(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createLibraryBook(tenantId, body as never);
  }

  @Post('library/issue')
  @RequirePermissions(Permission.LIBRARY_MANAGE)
  issueBook(@CurrentUser('sub') userId: string, @Body() body: Record<string, unknown>) {
    return this.erp.issueBook(userId, body as never);
  }

  @Post('library/return/:id')
  @RequirePermissions(Permission.LIBRARY_MANAGE)
  returnBook(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.erp.returnBook(userId, id);
  }

  // HR
  @Get('hr/staff')
  @RequirePermissions(Permission.HR_READ)
  listStaff(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listStaff(tenantId);
  }

  @Post('hr/staff')
  @RequirePermissions(Permission.HR_MANAGE)
  createStaff(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createStaffProfile(tenantId, body as never);
  }

  @Get('hr/leave')
  @RequirePermissions(Permission.HR_READ)
  listLeave(@CurrentUser('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.erp.listLeaveApplications(tenantId, status);
  }

  @Post('hr/leave')
  @RequirePermissions(Permission.HR_MANAGE)
  applyLeave(@CurrentUser('sub') userId: string, @Body() body: Record<string, unknown>) {
    return this.erp.applyLeave(userId, body as never);
  }

  @Patch('hr/leave/:id')
  @RequirePermissions(Permission.HR_MANAGE)
  approveLeave(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() body: { approved: boolean }) {
    return this.erp.approveLeave(userId, id, body.approved);
  }

  @Post('hr/salary')
  @RequirePermissions(Permission.HR_MANAGE)
  generateSalary(@Body() body: Record<string, unknown>) {
    return this.erp.generateSalarySlip(body as never);
  }

  // Hostel
  @Get('hostel')
  @RequirePermissions(Permission.HOSTEL_READ)
  listHostels(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listHostels(tenantId);
  }

  @Post('hostel')
  @RequirePermissions(Permission.HOSTEL_MANAGE)
  createHostel(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createHostel(tenantId, body as never);
  }

  @Post('hostel/rooms')
  @RequirePermissions(Permission.HOSTEL_MANAGE)
  createRoom(@Body() body: Record<string, unknown>) {
    return this.erp.createHostelRoom(body as never);
  }

  @Post('hostel/allocate')
  @RequirePermissions(Permission.HOSTEL_MANAGE)
  allocateHostel(@Body() body: Record<string, unknown>) {
    return this.erp.allocateHostel(body as never);
  }

  // Inventory
  @Get('inventory')
  @RequirePermissions(Permission.INVENTORY_READ)
  listInventory(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listInventory(tenantId);
  }

  @Post('inventory')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  createInventory(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.createInventoryItem(tenantId, body as never);
  }

  @Post('inventory/transactions')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  inventoryTransaction(@Body() body: Record<string, unknown>) {
    return this.erp.recordInventoryTransaction(body as never);
  }

  // Notifications & Discipline
  @Get('notifications')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  listNotifications(@CurrentUser('tenantId') tenantId: string) {
    return this.erp.listNotifications(tenantId);
  }

  @Post('notifications')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  sendNotification(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.erp.sendNotification(tenantId, body as never);
  }

  @Get('discipline')
  @RequirePermissions(Permission.DISCIPLINE_READ)
  listDiscipline(@CurrentUser('tenantId') tenantId: string, @Query('candidateId') candidateId?: string) {
    return this.erp.listDisciplineRecords(tenantId, candidateId);
  }

  @Post('discipline')
  @RequirePermissions(Permission.DISCIPLINE_MANAGE)
  createDiscipline(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.erp.createDisciplineRecord(user.tenantId, user.sub, body as never);
  }

  // ─── Extended ERP ──────────────────────────────────────────────

  @Get('reports')
  @RequirePermissions(Permission.ANALYTICS_VIEW)
  schoolReports(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.getSchoolReports(tenantId);
  }

  @Get('departments')
  @RequirePermissions(Permission.DEPARTMENT_READ)
  listDepartments(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.listDepartments(tenantId);
  }

  @Post('departments')
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  createDepartment(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.extended.createDepartment(tenantId, body as never);
  }

  @Get('branches')
  @RequirePermissions(Permission.BRANCH_READ)
  listBranches(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.listBranches(tenantId);
  }

  @Post('branches')
  @RequirePermissions(Permission.BRANCH_MANAGE)
  createBranch(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.extended.createBranch(tenantId, body as never);
  }

  @Get('fees/defaulters')
  @RequirePermissions(Permission.FEE_READ)
  listDefaulters(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.listDefaulters(tenantId);
  }

  @Get('fees/daily-collection')
  @RequirePermissions(Permission.FEE_READ)
  dailyCollection(@CurrentUser('tenantId') tenantId: string, @Query('date') date?: string) {
    return this.extended.getDailyCollection(tenantId, date);
  }

  @Get('fees/scholarships')
  @RequirePermissions(Permission.FEE_READ)
  listScholarships(@CurrentUser('tenantId') tenantId: string, @Query('candidateId') candidateId?: string) {
    return this.extended.listScholarships(tenantId, candidateId);
  }

  @Post('fees/scholarships')
  @RequirePermissions(Permission.FEE_MANAGE)
  createScholarship(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.extended.createScholarship(tenantId, body as never);
  }

  @Post('fees/generate-batch')
  @RequirePermissions(Permission.FEE_MANAGE)
  generateBatchInvoices(@CurrentUser('tenantId') tenantId: string, @Body() body: { batchId: string; feeStructureId: string }) {
    return this.extended.generateInvoicesForBatch(tenantId, body.batchId, body.feeStructureId);
  }

  @Post('fees/payment-order')
  @RequirePermissions(Permission.PAYMENT_ONLINE)
  createPaymentOrder(@CurrentUser('tenantId') tenantId: string, @Body() body: { invoiceId: string }) {
    return this.extended.createPaymentOrder(tenantId, body.invoiceId);
  }

  @Post('fees/payment-verify')
  @RequirePermissions(Permission.PAYMENT_ONLINE)
  verifyPayment(
    @CurrentUser() user: JwtPayload,
    @Body() body: { orderId: string; razorpayPaymentId?: string; razorpaySignature?: string },
  ) {
    return this.extended.verifyPaymentOrder(
      user.tenantId,
      body.orderId,
      user.sub,
      body.razorpayPaymentId,
      body.razorpaySignature,
    );
  }

  @Get('documents/fee-receipt/:paymentId')
  @RequirePermissions(Permission.FEE_READ)
  async feeReceiptHtml(
    @CurrentUser('tenantId') tenantId: string,
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    const html = await this.documents.feeReceiptHtml(tenantId, paymentId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('documents/report-card/:id')
  @RequirePermissions(Permission.REPORT_CARD_READ)
  async reportCardHtml(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.documents.reportCardHtml(tenantId, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('documents/certificate/:id')
  @RequirePermissions(Permission.CERTIFICATE_READ)
  async certificateHtml(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.documents.certificateHtml(tenantId, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('hr/staff-attendance')
  @RequirePermissions(Permission.HR_READ)
  listStaffAttendance(@CurrentUser('tenantId') tenantId: string, @Query('date') date?: string) {
    return this.extended.listStaffAttendance(tenantId, date);
  }

  @Post('hr/staff-attendance')
  @RequirePermissions(Permission.HR_MANAGE)
  markStaffAttendance(@Body() body: Record<string, unknown>) {
    return this.extended.markStaffAttendance(body as never);
  }

  @Get('student-leave')
  @RequirePermissions(Permission.STUDENT_LEAVE_READ)
  listStudentLeave(@CurrentUser('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.extended.listStudentLeave(tenantId, status);
  }

  @Post('student-leave')
  @RequirePermissions(Permission.STUDENT_LEAVE_MANAGE)
  applyStudentLeave(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.extended.applyStudentLeave(user.tenantId, user.sub, body as never);
  }

  @Patch('student-leave/:id')
  @RequirePermissions(Permission.STUDENT_LEAVE_MANAGE)
  approveStudentLeave(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() body: { approved: boolean }) {
    return this.extended.approveStudentLeave(userId, id, body.approved);
  }

  @Post('promotions')
  @RequirePermissions(Permission.PROMOTION_MANAGE)
  promoteStudents(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.extended.promoteStudents(user.tenantId, user.sub, body as never);
  }

  @Get('alumni')
  @RequirePermissions(Permission.ALUMNI_READ)
  listAlumni(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.listAlumni(tenantId);
  }

  @Post('alumni/:candidateId')
  @RequirePermissions(Permission.ALUMNI_MANAGE)
  markAlumni(@CurrentUser('tenantId') tenantId: string, @Param('candidateId') candidateId: string, @Body() body: Record<string, unknown>) {
    return this.extended.markAlumni(tenantId, candidateId, body as never);
  }

  @Get('certificates')
  @RequirePermissions(Permission.CERTIFICATE_READ)
  listCertificates(@CurrentUser('tenantId') tenantId: string, @Query('candidateId') candidateId?: string) {
    return this.extended.listCertificates(tenantId, candidateId);
  }

  @Post('certificates')
  @RequirePermissions(Permission.CERTIFICATE_MANAGE)
  issueCertificate(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.extended.issueCertificate(user.tenantId, user.sub, body as never);
  }

  @Get('grading-configs')
  @RequirePermissions(Permission.REPORT_CARD_READ)
  listGradingConfigs(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.listGradingConfigs(tenantId);
  }

  @Post('grading-configs')
  @RequirePermissions(Permission.REPORT_CARD_MANAGE)
  upsertGradingConfig(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.extended.upsertGradingConfig(tenantId, body as never);
  }

  @Get('transport/vehicles')
  @RequirePermissions(Permission.TRANSPORT_READ)
  listVehicles(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.listVehicles(tenantId);
  }

  @Post('transport/vehicles')
  @RequirePermissions(Permission.TRANSPORT_MANAGE)
  createVehicle(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.extended.createVehicle(tenantId, body as never);
  }

  @Post('transport/maintenance')
  @RequirePermissions(Permission.TRANSPORT_MANAGE)
  recordMaintenance(@Body() body: Record<string, unknown>) {
    return this.extended.recordVehicleMaintenance(body as never);
  }

  @Get('transport/driver-route')
  @RequirePermissions(Permission.TRANSPORT_READ)
  driverRoute(@CurrentUser('tenantId') tenantId: string, @Query('phone') phone: string) {
    return this.extended.getDriverRoute(tenantId, phone);
  }

  @Get('inventory/suppliers')
  @RequirePermissions(Permission.INVENTORY_READ)
  listSuppliers(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.listSuppliers(tenantId);
  }

  @Post('inventory/suppliers')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  createSupplier(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.extended.createSupplier(tenantId, body as never);
  }

  @Get('inventory/purchase-orders')
  @RequirePermissions(Permission.INVENTORY_READ)
  listPurchaseOrders(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.listPurchaseOrders(tenantId);
  }

  @Post('inventory/purchase-orders')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  createPurchaseOrder(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.extended.createPurchaseOrder(tenantId, body as never);
  }

  @Post('hostel/visitor-pass')
  @RequirePermissions(Permission.HOSTEL_MANAGE)
  createVisitorPass(@Body() body: Record<string, unknown>) {
    return this.extended.createVisitorPass(body as never);
  }

  @Get('hostel/visitor-passes')
  @RequirePermissions(Permission.HOSTEL_READ)
  listVisitorPasses(@Query('candidateId') candidateId?: string) {
    return this.extended.listVisitorPasses(candidateId);
  }

  @Post('timetable/substitute')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  assignSubstitute(@CurrentUser('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    return this.extended.assignSubstitute(tenantId, body as never);
  }

  @Get('timetable/clashes')
  @RequirePermissions(Permission.TIMETABLE_READ)
  detectClashes(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.detectTimetableClashes(tenantId);
  }

  @Post('notifications/absent-alert')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  notifyAbsent(@CurrentUser('tenantId') tenantId: string, @Body() body: { batchId: string; date: string }) {
    return this.extended.notifyAbsentStudents(tenantId, body.batchId, body.date);
  }

  @Post('notifications/fee-reminder')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  notifyFeeDefaulters(@CurrentUser('tenantId') tenantId: string) {
    return this.extended.notifyFeeDefaulters(tenantId);
  }

  @Post('admissions/:id/enroll')
  @RequirePermissions(Permission.ADMISSION_MANAGE)
  enrollApplication(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { batchId: string }) {
    return this.extended.enrollFromApplication(user.tenantId, id, body.batchId, user.sub);
  }
}
