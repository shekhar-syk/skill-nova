import { Resend } from 'resend';
import { config } from '../config/env.js';

const resendClient = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

export async function sendTransactionalEmail({ to, subject, html, text }) {
  if (!to) return { sent: false, mode: 'skipped', reason: 'Missing recipient' };

  if (!resendClient) {
    console.info(`[Email Fallback] To: ${to} | Subject: ${subject}`);
    return { sent: true, mode: 'sandbox-log', recipient: to, subject };
  }

  try {
    const response = await resendClient.emails.send({
      from: config.resend.emailFrom,
      to,
      subject,
      html,
      text: text || subject,
    });
    return { sent: true, mode: 'resend', id: response?.data?.id || null };
  } catch (err) {
    console.error('Resend email delivery failed gracefully:', err.message);
    return { sent: false, mode: 'resend-error', error: err.message };
  }
}

export const emailTemplates = {
  registrationWelcome: ({ fullName }) => ({
    subject: 'Welcome to SKILLNOVA — Your Learning Account is Ready',
    html: `<h2>Welcome to SKILLNOVA, ${fullName}</h2><p>Your student account is active. Explore 45+ engineering and technology programs in your dashboard.</p>`,
  }),
  passwordReset: ({ fullName, resetUrl }) => ({
    subject: 'SKILLNOVA Password Reset Request',
    html: `<p>Hello ${fullName},</p><p>Use the link below to reset your password (valid for 30 minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  }),
  adminEnquiryAlert: ({ fullName, email, mobileNumber, courseInterest, learningPreference, message }) => ({
    subject: `New SKILLNOVA Course Enquiry: ${courseInterest}`,
    html: `<h3>New Enquiry Received</h3><p><strong>Name:</strong> ${fullName}<br/><strong>Email:</strong> ${email}<br/><strong>Mobile:</strong> ${mobileNumber}<br/><strong>Course:</strong> ${courseInterest}<br/><strong>Mode:</strong> ${learningPreference}</p><p>${message}</p>`,
  }),
  admissionConfirmation: ({ fullName, registrationId, courseTitle, totalFee, amountPaid, remainingBalance, status }) => ({
    subject: `SKILLNOVA Admission Registered (${registrationId})`,
    html: `<h2>Admission Summary — ${registrationId}</h2><p>Dear ${fullName},</p><p>Your application for <strong>${courseTitle}</strong> is recorded with status <strong>${status}</strong>.</p><ul><li>Total Fee: INR ${totalFee}</li><li>Amount Paid: INR ${amountPaid}</li><li>Remaining Balance: INR ${remainingBalance}</li></ul>`,
  }),
  paymentSuccess: ({ fullName, receiptNumber, courseTitle, amount, remainingBalance }) => ({
    subject: `Payment Receipt ${receiptNumber} — SKILLNOVA`,
    html: `<h2>Payment Confirmed</h2><p>Thank you ${fullName}. We received <strong>INR ${amount}</strong> for <strong>${courseTitle}</strong>.</p><p>Receipt Number: <strong>${receiptNumber}</strong><br/>Remaining Balance: <strong>INR ${remainingBalance}</strong></p>`,
  }),
  paymentFailed: ({ fullName, courseTitle, reason }) => ({
    subject: `Payment Unsuccessful — SKILLNOVA`,
    html: `<p>Hello ${fullName},</p><p>Your payment attempt for <strong>${courseTitle}</strong> could not be completed (${reason || 'Gateway declined'}). You can retry safely from your dashboard.</p>`,
  }),
  courseEnrollment: ({ fullName, courseTitle }) => ({
    subject: `Enrollment Activated: ${courseTitle}`,
    html: `<h2>You are enrolled in ${courseTitle}</h2><p>Hello ${fullName}, your modules, labs, quizzes, and assignments are now unlocked in your SKILLNOVA Student Dashboard.</p>`,
  }),
  assignmentSubmitted: ({ fullName, assignmentTitle }) => ({
    subject: `Assignment Received: ${assignmentTitle}`,
    html: `<p>Hello ${fullName}, your submission for <strong>${assignmentTitle}</strong> has been logged and queued for mentor review.</p>`,
  }),
  certificateIssued: ({ fullName, courseTitle, certificateCode }) => ({
    subject: `Certificate Issued (${certificateCode}) — SKILLNOVA`,
    html: `<h2>Congratulations, ${fullName}!</h2><p>You have earned your verified SKILLNOVA certificate for <strong>${courseTitle}</strong>.</p><p>Certificate ID: <strong>${certificateCode}</strong></p>`,
  }),
};
