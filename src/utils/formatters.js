import { jsPDF } from 'jspdf';

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function downloadCertificatePdf(cert) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // Deep Navy Outer Border
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, width, height, 'F');
  doc.setDrawColor(10, 15, 36);
  doc.setLineWidth(14);
  doc.rect(24, 24, width - 48, height - 48);

  // Violet Inner Accent Line
  doc.setDrawColor(109, 40, 217);
  doc.setLineWidth(2);
  doc.rect(42, 42, width - 84, height - 84);

  // Header
  doc.setTextColor(109, 40, 217);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SKILLNOVA INTERNATIONAL TECH ACADEMY', width / 2, 105, { align: 'center' });

  doc.setTextColor(10, 15, 36);
  doc.setFontSize(34);
  doc.text('CERTIFICATE OF COMPLETION', width / 2, 155, { align: 'center' });

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('This credential certifies that', width / 2, 205, { align: 'center' });

  doc.setTextColor(10, 15, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(String(cert.student_name || cert.studentName), width / 2, 252, { align: 'center' });

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('has successfully completed all practical labs, assessments, and capstone requirements for', width / 2, 295, { align: 'center' });

  doc.setTextColor(109, 40, 217);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(String(cert.course_title || cert.courseTitle), width / 2, 338, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Standing: ${cert.grade || 'Distinction'}   |   Issued: ${formatDate(cert.issued_at || cert.issuedAt)}`, width / 2, 385, { align: 'center' });

  // Footer verification block
  doc.setDrawColor(203, 213, 225);
  doc.line(90, 455, 290, 455);
  doc.line(width - 290, 455, width - 90, 455);

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Academic Directorate, SKILLNOVA', 190, 475, { align: 'center' });
  doc.text(`Certificate ID: ${cert.certificate_code || cert.certificateCode}`, width - 190, 475, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Verify authenticity anytime at /verify-certificate', width / 2, 520, { align: 'center' });

  doc.save(`${cert.certificate_code || cert.certificateCode}.pdf`);
}

export function downloadReceiptPdf(receipt) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFillColor(10, 15, 36);
  doc.rect(0, 0, 595, 100, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SKILLNOVA', 44, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Official Admission & Payment Receipt', 44, 74);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  let y = 145;
  const rows = [
    ['Receipt Number', receipt.receiptNumber],
    ['Registration ID', receipt.registrationId],
    ['Applicant Name', receipt.applicantName],
    ['Email', receipt.applicantEmail],
    ['Program', receipt.courseTitle],
    ['Payment Type', receipt.paymentType],
    ['Gateway Order ID', receipt.orderId],
    ['Gateway Payment ID', receipt.paymentId || 'Verified'],
    ['Amount Paid Now', `INR ${Number(receipt.amount).toLocaleString('en-IN')}`],
    ['Total Course Fee', `INR ${Number(receipt.totalFee).toLocaleString('en-IN')}`],
    ['Total Paid to Date', `INR ${Number(receipt.amountPaid).toLocaleString('en-IN')}`],
    ['Remaining Balance', `INR ${Number(receipt.remainingBalance).toLocaleString('en-IN')}`],
    ['Admission Status', receipt.admissionStatus],
    ['Date', formatDate(receipt.paidAt || new Date())],
  ];

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 44, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value ?? '—'), 210, y);
    doc.setDrawColor(226, 232, 240);
    doc.line(44, y + 10, 550, y + 10);
    y += 32;
  }

  doc.save(`${receipt.receiptNumber || 'SKILLNOVA-Receipt'}.pdf`);
}
