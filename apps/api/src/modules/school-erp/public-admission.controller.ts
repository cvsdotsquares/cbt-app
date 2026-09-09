import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/permissions.decorator';
import { SchoolErpExtendedService } from './school-erp-extended.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Public Admission')
@Controller('public/admission')
@Public()
export class PublicAdmissionController {
  constructor(
    private extended: SchoolErpExtendedService,
    private prisma: PrismaService,
  ) {}

  @Get(':tenantSlug/info')
  @ApiOperation({ summary: 'Get public school info for admission page' })
  async getSchoolInfo(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
      select: { id: true, name: true, slug: true, logoUrl: true, branding: true },
    });
    if (!tenant) return { found: false };
    return { found: true, ...tenant };
  }

  @Post(':tenantSlug/enquiry')
  @ApiOperation({ summary: 'Submit admission enquiry (public, no auth)' })
  createEnquiry(@Param('tenantSlug') tenantSlug: string, @Body() body: Record<string, string>) {
    return this.extended.publicCreateEnquiry(tenantSlug, body);
  }

  @Post(':tenantSlug/apply')
  @ApiOperation({ summary: 'Submit admission application (public, no auth)' })
  createApplication(@Param('tenantSlug') tenantSlug: string, @Body() body: Record<string, unknown>) {
    return this.extended.publicCreateApplication(tenantSlug, body);
  }
}
