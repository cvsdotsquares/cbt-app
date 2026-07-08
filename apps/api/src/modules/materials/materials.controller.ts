import {
  Controller, Get, Post, Delete, Param, Query, UseGuards, UseInterceptors,
  UploadedFile, Body, BadRequestException, UsePipes, ValidationPipe, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { MaterialsService } from './materials.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '@cbt/shared';
import { MaterialType } from '@prisma/client';

const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/octet-stream',
    ];
    const ext = file.originalname.toLowerCase();
    if (
      allowed.includes(file.mimetype)
      || ext.endsWith('.pdf')
      || ext.endsWith('.txt')
      || ext.endsWith('.md')
    ) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Only PDF, TXT, and MD files are allowed'), false);
    }
  },
});

@ApiTags('Materials')
@Controller('materials')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class MaterialsController {
  constructor(private materialsService: MaterialsService) {}

  @Get()
  @RequirePermissions(Permission.MATERIAL_READ)
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('chapterId') chapterId?: string,
    @Query('type') type?: MaterialType,
    @Query('academicClassId') academicClassId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.materialsService.findAll(tenantId, { chapterId, type, academicClassId, subjectId });
  }

  @Post('upload')
  @RequirePermissions(Permission.MATERIAL_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: false }))
  @ApiOperation({ summary: 'Upload study material (PDF, notes)' })
  upload(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: {
      title?: string;
      type?: MaterialType;
      academicClassId?: string;
      subjectId?: string;
      bookId?: string;
      chapterId?: string;
      topicId?: string;
      academicSession?: string;
      fullBook?: string | boolean;
    },
  ) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('No file uploaded. Use field name "file" with a PDF or text file.');
    }
    const type = body.type || MaterialType.NCERT;
    const title = body.title?.trim() || file.originalname;
    return this.materialsService.upload(tenantId, userId, file, {
      title,
      type,
      academicClassId: body.academicClassId!,
      subjectId: body.subjectId!,
      chapterId: body.chapterId,
      topicId: body.topicId,
      bookId: body.bookId,
      academicSession: body.academicSession,
      fullBook: body.fullBook === 'true' || body.fullBook === true || body.fullBook === '1',
    });
  }

  @Get(':id/file')
  @RequirePermissions(Permission.MATERIAL_READ)
  @ApiOperation({ summary: 'View or download uploaded file' })
  async getFile(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Query('download') download?: string,
  ) {
    const { stream, fileName, mimeType } = await this.materialsService.getFileStream(id, tenantId);
    const disposition = download === '1' ? 'attachment' : 'inline';
    const safeName = fileName.replace(/[^\w.\-() ]/g, '_');
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `${disposition}; filename="${safeName}"`,
    });
  }

  @Get(':id')
  @RequirePermissions(Permission.MATERIAL_READ)
  findOne(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.materialsService.findOne(id, tenantId);
  }

  @Post(':id/reindex')
  @RequirePermissions(Permission.MATERIAL_UPLOAD)
  reindex(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.materialsService.reindex(id, tenantId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MATERIAL_DELETE)
  delete(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.materialsService.delete(id, tenantId);
  }
}
