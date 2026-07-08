import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '@cbt/shared';

@ApiTags('Batches')
@Controller('batches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class BatchesController {
  constructor(private batchesService: BatchesService) {}

  @Get()
  @RequirePermissions(Permission.BATCH_READ)
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.batchesService.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.BATCH_READ)
  findOne(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.batchesService.findOne(id, tenantId);
  }

  @Post()
  @RequirePermissions(Permission.BATCH_MANAGE)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { academicClassId: string; name: string; academicYear: string },
  ) {
    return this.batchesService.create(tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions(Permission.BATCH_MANAGE)
  @ApiOperation({ summary: 'Update a batch' })
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { academicClassId?: string; name?: string; academicYear?: string; isActive?: boolean },
  ) {
    return this.batchesService.update(id, tenantId, body);
  }

  @Delete(':id')
  @RequirePermissions(Permission.BATCH_MANAGE)
  @ApiOperation({ summary: 'Delete a batch' })
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.batchesService.remove(id, tenantId);
  }

  @Post(':id/enroll')
  @RequirePermissions(Permission.BATCH_MANAGE)
  enroll(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { candidateId: string; rollNumber?: string },
  ) {
    return this.batchesService.enrollStudent(id, tenantId, body.candidateId, body.rollNumber);
  }

  @Post(':id/teachers')
  @RequirePermissions(Permission.BATCH_MANAGE)
  assignTeacher(
    @Param('id') id: string,
    @Body() body: { userId: string; subjectId: string },
  ) {
    return this.batchesService.assignTeacher(id, body.userId, body.subjectId);
  }

  @Get(':id/syllabus-progress')
  @RequirePermissions(Permission.SYLLABUS_READ)
  getSyllabusProgress(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.batchesService.getSyllabusProgress(id, tenantId, subjectId);
  }

  @Patch(':id/syllabus-progress')
  @RequirePermissions(Permission.SYLLABUS_MANAGE)
  updateSyllabusProgress(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { chapterId?: string; topicId?: string; status: string },
  ) {
    return this.batchesService.updateSyllabusProgress(
      id, tenantId,
      { ...body, status: body.status as never },
      userId,
    );
  }

  @Post(':id/syllabus-progress/bulk')
  @RequirePermissions(Permission.SYLLABUS_MANAGE)
  bulkUpdate(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { chapterIds: string[]; status: string },
  ) {
    return this.batchesService.bulkUpdateChapterProgress(
      id, tenantId, body.chapterIds, body.status as never, userId,
    );
  }
}
