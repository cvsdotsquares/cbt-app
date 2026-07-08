import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import { MaterialType } from '@prisma/client';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import type { ReadStream } from 'fs';

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);
  private uploadDir: string;

  constructor(
    private prisma: PrismaService,
    private ragService: RagService,
    private config: ConfigService,
  ) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR')
      || path.join(process.cwd(), 'uploads', 'materials');
    fs.mkdir(this.uploadDir, { recursive: true }).catch((e) => {
      this.logger.error(`Failed to create upload directory: ${e}`);
    });
  }

  async findAll(
    tenantId: string,
    filters?: {
      chapterId?: string;
      type?: MaterialType;
      academicClassId?: string;
      subjectId?: string;
    },
  ) {
    return this.prisma.studyMaterial.findMany({
      where: {
        tenantId,
        ...(filters?.chapterId ? { chapterId: filters.chapterId } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.academicClassId ? { academicClassId: filters.academicClassId } : {}),
        ...(filters?.subjectId ? { subjectId: filters.subjectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        academicClass: { select: { level: true, name: true } },
        subject: { select: { name: true, code: true } },
        chapter: { select: { title: true, number: true } },
        topic: { select: { title: true } },
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const material = await this.prisma.studyMaterial.findFirst({
      where: { id, tenantId },
      include: {
        academicClass: true,
        subject: true,
        chapter: true,
        topic: true,
        chunks: { take: 5, orderBy: { chunkIndex: 'asc' } },
      },
    });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async getFileStream(id: string, tenantId: string): Promise<{
    stream: ReadStream;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }> {
    const material = await this.prisma.studyMaterial.findFirst({ where: { id, tenantId } });
    if (!material) throw new NotFoundException('Material not found');

    const filePath = path.isAbsolute(material.fileUrl)
      ? material.fileUrl
      : path.resolve(process.cwd(), material.fileUrl);

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('File not found on server. Try re-uploading.');
    }

    return {
      stream: createReadStream(filePath),
      fileName: material.fileName,
      mimeType: material.mimeType || 'application/octet-stream',
      fileSize: material.fileSize,
    };
  }

  private async resolveSubjectMeta(academicClassId: string, subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: { books: { take: 1, orderBy: { orderIndex: 'asc' } } },
    });
    if (!subject) throw new BadRequestException('Invalid subject');
    if (subject.academicClassId !== academicClassId) {
      throw new BadRequestException('Subject does not belong to the selected class');
    }
    return {
      academicClassId,
      subjectId,
      bookId: subject.books[0]?.id ?? null,
    };
  }

  private async resolveChapterMeta(meta: {
    academicClassId: string;
    subjectId: string;
    chapterId: string;
    topicId?: string;
    bookId?: string;
  }) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: meta.chapterId },
      include: { book: { include: { subject: true } } },
    });
    if (!chapter) throw new BadRequestException('Invalid chapter selected');
    if (chapter.book.subject.id !== meta.subjectId) {
      throw new BadRequestException('Chapter does not belong to the selected subject');
    }
    if (chapter.book.subject.academicClassId !== meta.academicClassId) {
      throw new BadRequestException('Subject does not belong to the selected class');
    }
    return {
      academicClassId: meta.academicClassId,
      subjectId: meta.subjectId,
      bookId: meta.bookId || chapter.bookId,
      chapterId: meta.chapterId,
      topicId: meta.topicId || null,
    };
  }

  async upload(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    meta: {
      title: string;
      type: MaterialType;
      academicClassId: string;
      subjectId: string;
      chapterId?: string;
      topicId?: string;
      bookId?: string;
      academicSession?: string;
      fullBook?: boolean;
    },
  ) {
    if (!meta.academicClassId || !meta.subjectId) {
      throw new BadRequestException('Class and Subject are required.');
    }

    const isFullBook = meta.fullBook === true;

    const resolved = isFullBook
      ? { ...(await this.resolveSubjectMeta(meta.academicClassId, meta.subjectId)), chapterId: null, topicId: null }
      : meta.chapterId
        ? await this.resolveChapterMeta({
          academicClassId: meta.academicClassId,
          subjectId: meta.subjectId,
          chapterId: meta.chapterId,
          topicId: meta.topicId,
          bookId: meta.bookId,
        })
        : {
          ...(await this.resolveSubjectMeta(meta.academicClassId, meta.subjectId)),
          chapterId: null,
          topicId: meta.topicId || null,
        };

    const tenantDir = path.join(this.uploadDir, tenantId);
    await fs.mkdir(tenantDir, { recursive: true });

    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(tenantDir, safeName);
    await fs.writeFile(filePath, file.buffer);

    const mimeType = file.mimetype === 'application/octet-stream' && file.originalname.endsWith('.pdf')
      ? 'application/pdf'
      : file.mimetype;

    const material = await this.prisma.studyMaterial.create({
      data: {
        tenantId,
        title: meta.title,
        type: meta.type,
        academicClassId: resolved.academicClassId,
        subjectId: resolved.subjectId,
        bookId: resolved.bookId,
        chapterId: resolved.chapterId,
        topicId: isFullBook || !meta.chapterId ? null : resolved.topicId,
        isFullBook,
        academicSession: meta.academicSession || '2025-26',
        uploadedById: userId,
        fileName: file.originalname,
        fileUrl: filePath,
        fileSize: file.size,
        mimeType,
        status: 'PENDING',
      },
      include: {
        academicClass: { select: { level: true, name: true } },
        subject: { select: { name: true } },
        chapter: { select: { number: true, title: true } },
      },
    });

    void this.indexInBackground(material.id);
    return { ...material, scope: isFullBook ? 'FULL_BOOK' : 'CHAPTER' };
  }

  private async indexInBackground(materialId: string) {
    try {
      await this.ragService.indexMaterial(materialId);
      this.logger.log(`Indexed material ${materialId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Indexing failed for ${materialId}: ${msg}`);
    }
  }

  async reindex(id: string, tenantId: string) {
    const material = await this.prisma.studyMaterial.findFirst({ where: { id, tenantId } });
    if (!material) throw new NotFoundException('Material not found');
    return this.ragService.indexMaterial(id);
  }

  async delete(id: string, tenantId: string) {
    const material = await this.prisma.studyMaterial.findFirst({ where: { id, tenantId } });
    if (!material) throw new NotFoundException('Material not found');
    await this.prisma.studyMaterial.delete({ where: { id } });
    try { await fs.unlink(material.fileUrl); } catch { /* ignore */ }
    return { deleted: true };
  }
}
