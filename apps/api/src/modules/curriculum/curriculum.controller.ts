import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurriculumService } from './curriculum.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '@cbt/shared';

@ApiTags('Curriculum')
@Controller('curriculum')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CurriculumController {
  constructor(private curriculumService: CurriculumService) {}

  @Get('classes')
  @RequirePermissions(Permission.CURRICULUM_READ)
  @ApiOperation({ summary: 'List academic classes with full syllabus tree' })
  getClasses(
    @CurrentUser('tenantId') tenantId: string,
    @Query('uploadedOnly') uploadedOnly?: string,
  ) {
    if (uploadedOnly === 'true' || uploadedOnly === '1') {
      return this.curriculumService.getClassesFromUploads(tenantId);
    }
    return this.curriculumService.getClasses(tenantId);
  }

  @Get('classes/:id')
  @RequirePermissions(Permission.CURRICULUM_READ)
  getClass(@Param('id') id: string) {
    return this.curriculumService.getClassTree(id);
  }

  @Get('subjects/:id/chapters')
  @RequirePermissions(Permission.CURRICULUM_READ)
  getSubjectChapters(@Param('id') id: string) {
    return this.curriculumService.getSubjectChapters(id);
  }

  @Post('classes')
  @RequirePermissions(Permission.CURRICULUM_MANAGE)
  createClass(@Body() body: { tenantId?: string; level: number; name: string; description?: string }) {
    return this.curriculumService.createClass(body);
  }

  @Post('subjects')
  @RequirePermissions(Permission.CURRICULUM_MANAGE)
  createSubject(@Body() body: { academicClassId: string; name: string; code: string; description?: string }) {
    return this.curriculumService.createSubject(body);
  }

  @Post('books')
  @RequirePermissions(Permission.CURRICULUM_MANAGE)
  createBook(@Body() body: { subjectId: string; title: string; publisher?: string; isNcert?: boolean }) {
    return this.curriculumService.createBook(body);
  }

  @Post('chapters')
  @RequirePermissions(Permission.CURRICULUM_MANAGE)
  createChapter(@Body() body: { bookId: string; number: number; title: string; description?: string }) {
    return this.curriculumService.createChapter(body);
  }

  @Post('topics')
  @RequirePermissions(Permission.CURRICULUM_MANAGE)
  createTopic(@Body() body: { chapterId: string; title: string; description?: string }) {
    return this.curriculumService.createSyllabusTopic(body);
  }
}
