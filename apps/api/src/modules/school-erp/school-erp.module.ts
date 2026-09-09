import { Module } from '@nestjs/common';
import { SchoolErpController } from './school-erp.controller';
import { PublicAdmissionController } from './public-admission.controller';
import { SchoolErpService } from './school-erp.service';
import { SchoolErpExtendedService } from './school-erp-extended.service';
import { PaymentService } from './payment.service';
import { DocumentsService } from './documents.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [SchoolErpController, PublicAdmissionController],
  providers: [SchoolErpService, SchoolErpExtendedService, PaymentService, DocumentsService],
  exports: [SchoolErpService, SchoolErpExtendedService, PaymentService, DocumentsService],
})
export class SchoolErpModule {}
