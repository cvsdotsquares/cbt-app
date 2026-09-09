import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AttendanceStatus, DayOfWeek, NoticeTarget } from '@prisma/client';
import { LiveClassProvider, LiveClassStatus, Permission, type JwtPayload } from '@cbt/shared';
import { SchoolService } from './school.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { isTeacherScoped } from '../../common/utils/teacher-scope.util';

@ApiTags('School')
@Controller('school')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SchoolController {
  constructor(private schoolService: SchoolService) {}

  private teacherScope(user: JwtPayload) {
    return isTeacherScoped(user) ? user.sub : undefined;
  }

  // ─── Timetable ───────────────────────────────────────────────

  @Get('periods')
  @RequirePermissions(Permission.TIMETABLE_READ)
  getPeriods(@CurrentUser('tenantId') tenantId: string) {
    return this.schoolService.getPeriodConfig(tenantId);
  }

  @Patch('periods')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  updatePeriods(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { periods: { periodNumber: number; label: string; startTime: string; endTime: string }[] },
  ) {
    return this.schoolService.updatePeriodConfig(tenantId, body.periods);
  }

  @Get('timetable')
  @RequirePermissions(Permission.TIMETABLE_READ)
  getTimetable(
    @CurrentUser() user: JwtPayload,
    @Query('batchId') batchId: string,
  ) {
    return this.schoolService.getTimetable(user.tenantId, batchId, this.teacherScope(user));
  }

  @Post('timetable/slots')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  upsertSlot(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      batchId: string;
      subjectId: string;
      teacherId?: string;
      dayOfWeek: DayOfWeek;
      periodNumber: number;
      room?: string;
    },
  ) {
    return this.schoolService.upsertTimetableSlot(
      user.tenantId,
      body,
      this.teacherScope(user),
    );
  }

  @Delete('timetable/slots/:id')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  deleteSlot(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schoolService.deleteTimetableSlot(user.tenantId, id, this.teacherScope(user));
  }

  // ─── Attendance ────────────────────────────────────────────────

  @Get('attendance')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  getAttendanceSheet(
    @CurrentUser() user: JwtPayload,
    @Query('batchId') batchId: string,
    @Query('date') date: string,
  ) {
    return this.schoolService.getAttendanceSheet(
      user.tenantId,
      batchId,
      date,
      this.teacherScope(user),
    );
  }

  @Post('attendance')
  @RequirePermissions(Permission.ATTENDANCE_MANAGE)
  markAttendance(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      batchId: string;
      date: string;
      entries: { candidateId: string; status: AttendanceStatus; remarks?: string }[];
    },
  ) {
    return this.schoolService.markAttendance(
      user.tenantId,
      body.batchId,
      body.date,
      body.entries,
      user.sub,
      this.teacherScope(user),
    );
  }

  @Get('attendance/report')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  attendanceReport(
    @CurrentUser() user: JwtPayload,
    @Query('batchId') batchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.schoolService.getAttendanceReport(
      user.tenantId,
      batchId,
      from,
      to,
      this.teacherScope(user),
    );
  }

  // ─── Homework ────────────────────────────────────────────────

  @Get('homework')
  @RequirePermissions(Permission.HOMEWORK_READ)
  listHomework(
    @CurrentUser() user: JwtPayload,
    @Query('batchId') batchId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.schoolService.listHomework(
      user.tenantId,
      { batchId, subjectId },
      this.teacherScope(user),
    );
  }

  @Post('homework')
  @RequirePermissions(Permission.HOMEWORK_MANAGE)
  createHomework(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      batchId: string;
      subjectId: string;
      title: string;
      description?: string;
      dueDate: string;
    },
  ) {
    return this.schoolService.createHomework(
      user.tenantId,
      user.sub,
      body,
      this.teacherScope(user),
    );
  }

  @Get('homework/:id')
  @RequirePermissions(Permission.HOMEWORK_READ)
  getHomework(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schoolService.getHomeworkDetail(user.tenantId, id, this.teacherScope(user));
  }

  @Post('homework/:id/submit')
  @RequirePermissions(Permission.HOMEWORK_SUBMIT)
  submitHomework(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.schoolService.submitHomework(user.tenantId, user.sub, id, body.content);
  }

  @Patch('homework/submissions/:id/grade')
  @RequirePermissions(Permission.HOMEWORK_MANAGE)
  gradeSubmission(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { grade: string; feedback?: string },
  ) {
    return this.schoolService.gradeHomeworkSubmission(
      user.tenantId,
      id,
      body.grade,
      body.feedback,
      this.teacherScope(user),
    );
  }

  @Get('student/homework')
  @RequirePermissions(Permission.HOMEWORK_READ)
  studentHomework(@CurrentUser() user: JwtPayload) {
    return this.schoolService.getStudentHomework(user.tenantId, user.sub);
  }

  // ─── Notices ─────────────────────────────────────────────────

  @Get('notices')
  @RequirePermissions(Permission.NOTICE_READ)
  listNotices(@CurrentUser('tenantId') tenantId: string) {
    return this.schoolService.listNotices(tenantId);
  }

  @Post('notices')
  @RequirePermissions(Permission.NOTICE_MANAGE)
  createNotice(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      title: string;
      body: string;
      targetType?: NoticeTarget;
      targetId?: string;
      expiresAt?: string;
    },
  ) {
    return this.schoolService.createNotice(user.tenantId, user.sub, body);
  }

  @Delete('notices/:id')
  @RequirePermissions(Permission.NOTICE_MANAGE)
  deleteNotice(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.schoolService.deleteNotice(tenantId, id);
  }

  // ─── Live classes (VC) ───────────────────────────────────────

  @Get('live-classes')
  @RequirePermissions(Permission.LIVE_CLASS_READ)
  listLiveClasses(
    @CurrentUser() user: JwtPayload,
    @Query('batchId') batchId?: string,
    @Query('status') status?: LiveClassStatus,
  ) {
    return this.schoolService.listLiveClasses(
      user.tenantId,
      { batchId, status },
      this.teacherScope(user),
    );
  }

  @Post('live-classes')
  @RequirePermissions(Permission.LIVE_CLASS_MANAGE)
  createLiveClass(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      batchId: string;
      subjectId: string;
      teacherId: string;
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      provider?: LiveClassProvider;
      meetingUrl?: string;
    },
  ) {
    return this.schoolService.createLiveClass(user.tenantId, user.sub, body, this.teacherScope(user));
  }

  @Patch('live-classes/:id/status')
  @RequirePermissions(Permission.LIVE_CLASS_MANAGE)
  updateLiveClassStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { status: LiveClassStatus; recordingUrl?: string },
  ) {
    return this.schoolService.updateLiveClassStatus(
      user.tenantId,
      id,
      body.status,
      this.teacherScope(user),
      body.recordingUrl,
    );
  }

  @Post('live-classes/:id/join')
  @RequirePermissions(Permission.LIVE_CLASS_JOIN)
  joinLiveClass(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schoolService.joinLiveClass(user.tenantId, user.sub, id);
  }

  @Get('student/live-classes')
  @RequirePermissions(Permission.LIVE_CLASS_READ)
  studentLiveClasses(@CurrentUser() user: JwtPayload) {
    return this.schoolService.getStudentLiveClasses(user.tenantId, user.sub);
  }

  // ─── Parent & student portals ────────────────────────────────

  @Post('parents/link')
  @RequirePermissions(Permission.PARENT_READ)
  @ApiOperation({ summary: 'Link a parent user to a student' })
  linkParent(
    @Body() body: { parentUserId: string; candidateId: string; relation?: string },
  ) {
    return this.schoolService.linkParent(body.parentUserId, body.candidateId, body.relation);
  }

  @Get('parent/dashboard')
  @RequirePermissions(Permission.PARENT_READ)
  parentDashboard(@CurrentUser() user: JwtPayload) {
    return this.schoolService.getParentDashboard(user.sub, user.tenantId);
  }

  @Get('student/dashboard')
  @RequirePermissions(Permission.LEARNING_READ)
  studentDashboard(@CurrentUser() user: JwtPayload) {
    return this.schoolService.getStudentSchoolDashboard(user.tenantId, user.sub);
  }
}
