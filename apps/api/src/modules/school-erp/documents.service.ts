import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function printShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>${esc(title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,serif;background:#f1f5f9;padding:24px;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:800px;margin:0 auto;background:#fff;border:2px solid #1e3a8a;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  h1{font-size:1.5rem;text-align:center;color:#1e3a8a;margin-bottom:8px}
  .sub{text-align:center;color:#64748b;font-size:.875rem;margin-bottom:32px}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:.9rem}
  th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}
  th{background:#f8fafc;font-weight:600}
  .row{display:flex;justify-content:space-between;margin:8px 0;font-size:.9rem}
  .total{font-size:1.1rem;font-weight:bold;margin-top:16px;text-align:right}
  .footer{margin-top:40px;text-align:center;font-size:.75rem;color:#94a3b8}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;border:1px solid #ccc}}
</style></head><body><div class="page">${body}<p class="footer">Print or Save as PDF (Ctrl+P / ⌘+P)</p></div></body></html>`;
}

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async feeReceiptHtml(tenantId: string, paymentId: string): Promise<string> {
    const payment = await this.prisma.feePayment.findFirst({
      where: { id: paymentId, invoice: { tenantId } },
      include: {
        invoice: {
          include: {
            candidate: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          },
        },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const inv = payment.invoice;
    const student = inv.candidate.user;

    const body = `
      <h1>${esc(tenant?.name ?? 'School')}</h1>
      <p class="sub">Fee Receipt · ${esc(payment.receiptNo ?? payment.id.slice(0, 8))}</p>
      <div class="row"><span>Date</span><span>${fmtDate(payment.paidAt)}</span></div>
      <div class="row"><span>Student</span><span>${esc(student.firstName)} ${esc(student.lastName)}</span></div>
      <div class="row"><span>Invoice No</span><span>${esc(inv.invoiceNo)}</span></div>
      <div class="row"><span>Payment Method</span><span>${esc(payment.method)}</span></div>
      ${payment.referenceNo ? `<div class="row"><span>Reference</span><span>${esc(payment.referenceNo)}</span></div>` : ''}
      <p class="total">Amount Paid: ₹${Number(payment.amount).toLocaleString('en-IN')}</p>
      <p class="footer" style="margin-top:24px">Received by: ${payment.recordedBy ? esc(`${payment.recordedBy.firstName} ${payment.recordedBy.lastName}`) : 'Online'}</p>
    `;
    return printShell(`Receipt ${payment.receiptNo}`, body);
  }

  async reportCardHtml(tenantId: string, reportCardId: string): Promise<string> {
    const rc = await this.prisma.reportCard.findFirst({
      where: { id: reportCardId, tenantId },
      include: {
        term: { include: { academicYear: true } },
        candidate: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!rc) throw new NotFoundException('Report card not found');

    const grades = await this.prisma.gradeEntry.findMany({
      where: { tenantId, termId: rc.termId, candidateId: rc.candidateId },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const student = rc.candidate.user;
    const rows = grades.map((g) =>
      `<tr><td>${esc(g.subject.name)}</td><td>${Number(g.marksObtained)}</td><td>${Number(g.maxMarks)}</td><td>${esc(g.grade ?? '—')}</td></tr>`,
    ).join('');

    const body = `
      <h1>${esc(tenant?.name ?? 'School')}</h1>
      <p class="sub">Report Card · ${esc(rc.term.name)} (${esc(rc.term.academicYear.name)})</p>
      <div class="row"><span>Student</span><span>${esc(student.firstName)} ${esc(student.lastName)}</span></div>
      <div class="row"><span>Overall Grade</span><span><strong>${esc(rc.overallGrade)}</strong></span></div>
      <div class="row"><span>Percentage</span><span>${Number(rc.percentage).toFixed(2)}%</span></div>
      ${rc.rank ? `<div class="row"><span>Rank</span><span>${rc.rank}</span></div>` : ''}
      ${rc.attendancePct ? `<div class="row"><span>Attendance</span><span>${Number(rc.attendancePct).toFixed(1)}%</span></div>` : ''}
      <table><thead><tr><th>Subject</th><th>Marks</th><th>Max</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table>
      ${rc.remarks ? `<p style="margin-top:16px;font-size:.875rem"><em>Remarks: ${esc(rc.remarks)}</em></p>` : ''}
    `;
    return printShell(`Report Card — ${student.firstName}`, body);
  }

  async certificateHtml(tenantId: string, certificateId: string): Promise<string> {
    const cert = await this.prisma.studentCertificate.findFirst({
      where: { id: certificateId, tenantId },
      include: {
        candidate: { include: { user: { select: { firstName: true, lastName: true } } } },
        issuedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const student = cert.candidate.user;
    const typeLabel = cert.type.replace(/_/g, ' ');

    const body = `
      <div style="text-align:center;padding:20px 0">
        <h1 style="font-size:1.75rem;margin-bottom:4px">${esc(tenant?.name ?? 'School')}</h1>
        <p class="sub">${esc(typeLabel)}</p>
        <p style="margin:32px 0;font-size:1rem">This is to certify that</p>
        <p style="font-size:1.5rem;font-weight:bold;margin:16px 0">${esc(student.firstName)} ${esc(student.lastName)}</p>
        <p style="margin:24px 0;font-size:1rem">${esc(cert.title)}</p>
        <p style="font-size:.875rem;color:#64748b">Certificate No: ${esc(cert.certificateNo)}</p>
        <p style="font-size:.875rem;color:#64748b;margin-top:8px">Issued: ${fmtDate(cert.issuedAt)}</p>
        ${cert.validUntil ? `<p style="font-size:.875rem;color:#64748b">Valid until: ${fmtDate(cert.validUntil)}</p>` : ''}
        <p style="margin-top:48px;font-size:.875rem">
          ${cert.issuedBy ? `Issued by: ${esc(cert.issuedBy.firstName)} ${esc(cert.issuedBy.lastName)}` : ''}
        </p>
      </div>
    `;
    return printShell(cert.title, body);
  }
}
