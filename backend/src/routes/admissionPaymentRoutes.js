import crypto from 'crypto';
import { Router } from 'express';
import { config } from '../config/env.js';
import { query, queryOne, withTransaction } from '../db/index.js';
import { authenticate, authorizeRoles, optionalAuth } from '../middleware/authMiddleware.js';
import { createNotification, logAudit } from '../services/auditService.js';
import { emailTemplates, sendTransactionalEmail } from '../services/emailService.js';
import {
  createGatewayOrder,
  createSandboxSignature,
  verifyRazorpaySignature,
  verifyWebhookSignature,
} from '../services/razorpayService.js';
import { generateCode } from '../utils/auth.js';
import { admissionSchema } from '../validators/schemas.js';

const router = Router();

// Create Admission (authoritatively fetches fee from PostgreSQL)
router.post('/admissions', optionalAuth, async (req, res, next) => {
  try {
    const data = admissionSchema.parse(req.body);
    const course = await queryOne(
      "SELECT id, title, slug, course_fee, advance_amount, full_amount, status FROM courses WHERE id = $1 AND status = 'PUBLISHED'",
      [data.courseId]
    );
    if (!course) {
      return res.status(404).json({ success: false, message: 'Selected course is not available.' });
    }

    const totalFee = Number(course.course_fee);
    const payableAmount = data.paymentOption === 'FULL' ? Number(course.full_amount) : Number(course.advance_amount);
    const registrationId = generateCode('SN-ADM');

    let userId = req.user?.id || null;
    if (!userId) {
      const userByEmail = await queryOne('SELECT id FROM users WHERE email = $1', [data.email]);
      if (userByEmail) userId = userByEmail.id;
    }

    const admission = await queryOne(
      `INSERT INTO admissions (
        registration_id, user_id, course_id, full_name, email, mobile_number, whatsapp_number,
        college_name, department, year_of_study, state, learning_preference, message,
        payment_option, total_fee, amount_paid, remaining_balance, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, 0, $15, 'PAYMENT_PENDING'
      ) RETURNING *`,
      [
        registrationId,
        userId,
        course.id,
        data.fullName,
        data.email,
        data.mobileNumber,
        data.whatsappNumber,
        data.collegeName,
        data.department,
        data.yearOfStudy,
        data.state,
        data.learningPreference,
        data.message || null,
        data.paymentOption,
        totalFee,
      ]
    );

    await logAudit({
      actorUserId: userId,
      action: 'ADMISSION_SUBMITTED',
      entityType: 'ADMISSION',
      entityId: admission.id,
      details: { registrationId, courseId: course.id, paymentOption: data.paymentOption },
      ipAddress: req.ip,
    });

    const mail = emailTemplates.admissionConfirmation({
      fullName: admission.full_name,
      registrationId: admission.registration_id,
      courseTitle: course.title,
      totalFee,
      amountPaid: 0,
      remainingBalance: totalFee,
      status: admission.status,
    });
    await sendTransactionalEmail({ to: admission.email, ...mail });

    res.status(201).json({
      success: true,
      admission: {
        id: admission.id,
        registrationId: admission.registration_id,
        courseId: course.id,
        courseTitle: course.title,
        fullName: admission.full_name,
        email: admission.email,
        paymentOption: admission.payment_option,
        totalFee,
        payableAmount,
        amountPaid: 0,
        remainingBalance: totalFee,
        status: admission.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Track Admission status safely (masks private phone/admin notes for public callers)
router.get('/admissions/track/:registrationId', optionalAuth, async (req, res, next) => {
  try {
    const adm = await queryOne(
      `SELECT a.*, c.title AS course_title, c.slug AS course_slug
       FROM admissions a
       JOIN courses c ON c.id = a.course_id
       WHERE a.registration_id = $1`,
      [req.params.registrationId]
    );
    if (!adm) return res.status(404).json({ success: false, message: 'Admission record not found.' });

    const isOwnerOrAdmin =
      req.user &&
      (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role) || req.user.id === adm.user_id || req.user.email === adm.email);

    res.json({
      success: true,
      admission: isOwnerOrAdmin
        ? adm
        : {
            registration_id: adm.registration_id,
            course_title: adm.course_title,
            full_name: adm.full_name,
            total_fee: adm.total_fee,
            amount_paid: adm.amount_paid,
            remaining_balance: adm.remaining_balance,
            status: adm.status,
            created_at: adm.created_at,
          },
    });
  } catch (err) {
    next(err);
  }
});

// Student: My admissions & payments
router.get('/admissions/my', authenticate, async (req, res, next) => {
  try {
    const admissionsRes = await query(
      `SELECT a.*, c.title AS course_title, c.slug AS course_slug
       FROM admissions a
       JOIN courses c ON c.id = a.course_id
       WHERE a.user_id = $1 OR a.email = $2
       ORDER BY a.id DESC`,
      [req.user.id, req.user.email]
    );
    const paymentsRes = await query(
      `SELECT p.*, c.title AS course_title, a.registration_id
       FROM payments p
       JOIN courses c ON c.id = p.course_id
       JOIN admissions a ON a.id = p.admission_id
       WHERE p.user_id = $1 OR a.email = $2
       ORDER BY p.id DESC`,
      [req.user.id, req.user.email]
    );
    res.json({
      success: true,
      admissions: admissionsRes.rows,
      payments: paymentsRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: List all admissions
router.get('/admissions', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { status = '', search = '' } = req.query;
    const conditions = [];
    const params = [];
    if (status.trim()) {
      params.push(status.trim());
      conditions.push(`a.status = $${params.length}`);
    }
    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(a.full_name) LIKE $${params.length} OR LOWER(a.email) LIKE $${params.length} OR LOWER(a.registration_id) LIKE $${params.length})`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rowsRes = await query(
      `SELECT a.*, c.title AS course_title
       FROM admissions a
       JOIN courses c ON c.id = a.course_id
       ${whereClause}
       ORDER BY a.id DESC`,
      params
    );
    res.json({ success: true, admissions: rowsRes.rows });
  } catch (err) {
    next(err);
  }
});

// Admin: Approve or Reject Admission
router.patch('/admissions/:id/status', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, adminNotes } = req.body;
    if (!['PENDING', 'PAYMENT_PENDING', 'ADVANCE_PAID', 'FULLY_PAID', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid admission status.' });
    }

    const updated = await queryOne(
      `UPDATE admissions SET status = $1, admin_notes = COALESCE($2, admin_notes), reviewed_by = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [status, adminNotes || null, req.user.id, id]
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Admission not found.' });

    if (status === 'APPROVED' && updated.user_id) {
      await query(
        `INSERT INTO enrollments (user_id, course_id, admission_id, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'ACTIVE'`,
        [updated.user_id, updated.course_id, updated.id]
      );
      await createNotification({
        userId: updated.user_id,
        title: 'Admission Approved',
        message: `Admission ${updated.registration_id} has been approved. Your course workspace is active.`,
        type: 'SUCCESS',
        category: 'PAYMENT',
        actionUrl: '/student',
      });
    }

    await logAudit({
      actorUserId: req.user.id,
      action: 'ADMISSION_STATUS_UPDATED',
      entityType: 'ADMISSION',
      entityId: id,
      details: { status },
      ipAddress: req.ip,
    });

    res.json({ success: true, admission: updated });
  } catch (err) {
    next(err);
  }
});

// Create Razorpay Order (authoritative DB pricing + ownership verification)
router.post('/payments/create-order', optionalAuth, async (req, res, next) => {
  try {
    const { admissionId, paymentType } = req.body;
    const adm = await queryOne(
      `SELECT a.*, c.title AS course_title, c.course_fee, c.advance_amount, c.full_amount
       FROM admissions a
       JOIN courses c ON c.id = a.course_id
       WHERE a.id = $1`,
      [Number(admissionId)]
    );

    if (!adm) {
      return res.status(404).json({ success: false, message: 'Admission record not found.' });
    }

    if (req.user && req.user.role === 'STUDENT' && adm.user_id !== req.user.id && adm.email !== req.user.email) {
      return res.status(403).json({ success: false, message: 'You are not authorized to pay for this admission.' });
    }

    if (adm.remaining_balance <= 0) {
      return res.status(400).json({ success: false, message: 'This admission is already fully paid.' });
    }

    const existingPending = await queryOne(
      "SELECT * FROM payments WHERE admission_id = $1 AND status = 'CREATED' ORDER BY id DESC LIMIT 1",
      [adm.id]
    );

    let amountToCharge = Number(adm.remaining_balance);
    let resolvedType = paymentType || adm.payment_option;
    if (adm.amount_paid === 0) {
      if (resolvedType === 'ADVANCE') {
        amountToCharge = Number(adm.advance_amount);
      } else {
        resolvedType = 'FULL';
        amountToCharge = Number(adm.full_amount);
      }
    } else {
      resolvedType = 'BALANCE';
      amountToCharge = Number(adm.remaining_balance);
    }

    if (existingPending && existingPending.amount === amountToCharge && existingPending.payment_type === resolvedType) {
      return res.json({
        success: true,
        order: {
          orderId: existingPending.razorpay_order_id,
          amount: existingPending.amount * 100,
          currency: existingPending.currency,
          keyId: existingPending.gateway_mode === 'SANDBOX_TEST' ? 'rzp_test_sandbox' : process.env.RAZORPAY_KEY_ID,
          mode: existingPending.gateway_mode,
          receiptNumber: existingPending.receipt_number,
          amountInInr: existingPending.amount,
          courseTitle: adm.course_title,
          applicantName: adm.full_name,
          applicantEmail: adm.email,
          applicantPhone: adm.mobile_number,
        },
      });
    }

    const receiptNumber = generateCode('SN-RCP');
    const gatewayOrder = await createGatewayOrder({
      amountInInr: amountToCharge,
      receiptNumber,
      notes: {
        admissionId: String(adm.id),
        registrationId: adm.registration_id,
        courseTitle: adm.course_title,
      },
    });

    await query(
      `INSERT INTO payments (
        admission_id, user_id, course_id, receipt_number, payment_type,
        amount, currency, razorpay_order_id, status, gateway_mode
      ) VALUES ($1, $2, $3, $4, $5, $6, 'INR', $7, 'CREATED', $8)`,
      [
        adm.id,
        adm.user_id || req.user?.id || null,
        adm.course_id,
        receiptNumber,
        resolvedType,
        amountToCharge,
        gatewayOrder.orderId,
        gatewayOrder.mode,
      ]
    );

    res.json({
      success: true,
      order: {
        orderId: gatewayOrder.orderId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        keyId: gatewayOrder.keyId,
        mode: gatewayOrder.mode,
        receiptNumber,
        amountInInr: amountToCharge,
        courseTitle: adm.course_title,
        applicantName: adm.full_name,
        applicantEmail: adm.email,
        applicantPhone: adm.mobile_number,
      },
    });
  } catch (err) {
    next(err);
  }
});

async function finalizeSuccessfulPayment({ orderId, paymentId, signature }) {
  return withTransaction(async (tx) => {
    const payment = await tx.queryOne('SELECT * FROM payments WHERE razorpay_order_id = $1', [orderId]);
    if (!payment) {
      const err = new Error('Payment order not found.');
      err.statusCode = 404;
      throw err;
    }

    if (payment.status === 'SUCCESS') {
      const adm = await tx.queryOne(
        `SELECT a.*, c.title AS course_title FROM admissions a JOIN courses c ON c.id = a.course_id WHERE a.id = $1`,
        [payment.admission_id]
      );
      return { alreadyProcessed: true, payment, admission: adm };
    }

    const isValidSig = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
      gatewayMode: payment.gateway_mode,
    });

    if (!isValidSig) {
      await tx.query(
        `UPDATE payments SET status = 'FAILED', failure_reason = 'Signature verification failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [payment.id]
      );
      const err = new Error('Payment signature verification failed.');
      err.statusCode = 400;
      throw err;
    }

    const updatedPayment = await tx.queryOne(
      `UPDATE payments SET
        razorpay_payment_id = $1,
        razorpay_signature = $2,
        status = 'SUCCESS',
        paid_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [paymentId, signature, payment.id]
    );

    const admission = await tx.queryOne('SELECT * FROM admissions WHERE id = $1', [payment.admission_id]);
    const newAmountPaid = Number(admission.amount_paid) + Number(payment.amount);
    const newRemaining = Math.max(0, Number(admission.total_fee) - newAmountPaid);
    const newStatus = newRemaining === 0 ? 'FULLY_PAID' : 'ADVANCE_PAID';

    const updatedAdmission = await tx.queryOne(
      `UPDATE admissions SET
        amount_paid = $1,
        remaining_balance = $2,
        status = $3,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [newAmountPaid, newRemaining, newStatus, admission.id]
    );

    const course = await tx.queryOne('SELECT id, title FROM courses WHERE id = $1', [admission.course_id]);

    const targetUserId = admission.user_id || payment.user_id;
    if (targetUserId) {
      const existingEnr = await tx.queryOne(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [targetUserId, admission.course_id]
      );
      if (!existingEnr) {
        await tx.query(
          `INSERT INTO enrollments (user_id, course_id, admission_id, status) VALUES ($1, $2, $3, 'ACTIVE')`,
          [targetUserId, admission.course_id, admission.id]
        );
        await tx.query('UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = $1', [admission.course_id]);
      }
    }

    return {
      alreadyProcessed: false,
      payment: updatedPayment,
      admission: { ...updatedAdmission, course_title: course.title },
      targetUserId,
    };
  });
}

// Verify Razorpay Payment (strictly blocks simulateSandbox in production)
router.post('/payments/verify', optionalAuth, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, simulateSandbox } = req.body;
    if (!razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'razorpay_order_id is required.' });
    }

    let paymentId = razorpay_payment_id;
    let signature = razorpay_signature;

    if (simulateSandbox) {
      if (config.isProduction || !config.allowSandboxPayments) {
        return res.status(403).json({
          success: false,
          message: 'Sandbox payment simulation is strictly disabled in production.',
        });
      }
      const existingOrder = await queryOne('SELECT gateway_mode FROM payments WHERE razorpay_order_id = $1', [
        razorpay_order_id,
      ]);
      if (existingOrder?.gateway_mode === 'SANDBOX_TEST') {
        paymentId = paymentId || `pay_test_${crypto.randomBytes(6).toString('hex')}`;
        signature = createSandboxSignature({ orderId: razorpay_order_id, paymentId });
      }
    }

    if (!paymentId || !signature) {
      return res.status(400).json({ success: false, message: 'Payment ID and signature are required.' });
    }

    const result = await finalizeSuccessfulPayment({
      orderId: razorpay_order_id,
      paymentId,
      signature,
    });

    if (!result.alreadyProcessed) {
      await logAudit({
        actorUserId: result.targetUserId || null,
        action: 'PAYMENT_VERIFIED',
        entityType: 'PAYMENT',
        entityId: result.payment.id,
        details: { amount: result.payment.amount, receiptNumber: result.payment.receipt_number },
        ipAddress: req.ip,
      });

      if (result.targetUserId) {
        await createNotification({
          userId: result.targetUserId,
          title: 'Payment Verified & Enrollment Active',
          message: `Receipt ${result.payment.receipt_number} for INR ${result.payment.amount} verified. Your course is unlocked.`,
          type: 'SUCCESS',
          category: 'PAYMENT',
          actionUrl: '/student',
        });
      }

      const mail = emailTemplates.paymentSuccess({
        fullName: result.admission.full_name,
        receiptNumber: result.payment.receipt_number,
        courseTitle: result.admission.course_title,
        amount: result.payment.amount,
        remainingBalance: result.admission.remaining_balance,
      });
      await sendTransactionalEmail({ to: result.admission.email, ...mail });

      if (result.targetUserId) {
        const enrMail = emailTemplates.courseEnrollment({
          fullName: result.admission.full_name,
          courseTitle: result.admission.course_title,
        });
        await sendTransactionalEmail({ to: result.admission.email, ...enrMail });
      }
    }

    res.json({
      success: true,
      message: 'Payment verified and recorded.',
      receipt: {
        receiptNumber: result.payment.receipt_number,
        orderId: result.payment.razorpay_order_id,
        paymentId: result.payment.razorpay_payment_id,
        amount: result.payment.amount,
        paymentType: result.payment.payment_type,
        paidAt: result.payment.paid_at,
        registrationId: result.admission.registration_id,
        applicantName: result.admission.full_name,
        applicantEmail: result.admission.email,
        courseTitle: result.admission.course_title,
        totalFee: result.admission.total_fee,
        amountPaid: result.admission.amount_paid,
        remainingBalance: result.admission.remaining_balance,
        admissionStatus: result.admission.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Record failed payment attempt cleanly
router.post('/payments/fail', async (req, res, next) => {
  try {
    const { razorpay_order_id, reason = 'Payment cancelled or declined' } = req.body;
    const payment = await queryOne('SELECT * FROM payments WHERE razorpay_order_id = $1', [razorpay_order_id]);
    if (!payment) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (payment.status !== 'SUCCESS') {
      await query(
        `UPDATE payments SET status = 'FAILED', failure_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [reason, payment.id]
      );
      const adm = await queryOne(
        'SELECT a.full_name, a.email, c.title AS course_title FROM admissions a JOIN courses c ON c.id = a.course_id WHERE a.id = $1',
        [payment.admission_id]
      );
      if (adm) {
        const failMail = emailTemplates.paymentFailed({
          fullName: adm.full_name,
          courseTitle: adm.course_title,
          reason,
        });
        await sendTransactionalEmail({ to: adm.email, ...failMail });
      }
    }

    res.json({ success: true, message: 'Payment failure recorded.' });
  } catch (err) {
    next(err);
  }
});

// Razorpay Webhook Endpoint (Signature Verified + idempotent admission/enrollment update)
router.post('/payments/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);
    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = req.body;
    if (event.event === 'payment.captured') {
      const entity = event.payload?.payment?.entity;
      if (entity?.order_id && entity?.id) {
        const payment = await queryOne('SELECT * FROM payments WHERE razorpay_order_id = $1', [entity.order_id]);
        if (payment && payment.status !== 'SUCCESS') {
          await query(
            `UPDATE payments SET status = 'SUCCESS', razorpay_payment_id = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [entity.id, payment.id]
          );
        }
      }
    }
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

// Admin: List all payments
router.get('/payments', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { status = '' } = req.query;
    const params = [];
    let where = '';
    if (status.trim()) {
      params.push(status.trim());
      where = 'WHERE p.status = $1';
    }

    const rowsRes = await query(
      `SELECT p.*, a.registration_id, a.full_name AS student_name, a.email AS student_email, c.title AS course_title
       FROM payments p
       JOIN admissions a ON a.id = p.admission_id
       JOIN courses c ON c.id = p.course_id
       ${where}
       ORDER BY p.id DESC`,
      params
    );
    res.json({ success: true, payments: rowsRes.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
