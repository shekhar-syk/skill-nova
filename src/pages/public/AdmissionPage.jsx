import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, Download, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button, Card, SectionHeading, StatusText } from '../../components/DesignSystem.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { downloadReceiptPdf, formatINR } from '../../utils/formatters.js';

export default function AdmissionPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [admission, setAdmission] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [paymentError, setPaymentError] = useState('');

  const [form, setForm] = useState({
    courseId: searchParams.get('courseId') || '',
    fullName: user?.fullName || '',
    email: user?.email || '',
    mobileNumber: user?.phone || '',
    whatsappNumber: user?.phone || '',
    collegeName: '',
    department: '',
    yearOfStudy: 'Final Year (4th Year)',
    state: '',
    learningPreference: 'Live Online Cohort',
    paymentOption: 'ADVANCE',
    message: '',
  });

  useEffect(() => {
    api.get('/courses?limit=60').then((res) => {
      const list = res.data.courses || [];
      setCourses(list);
      const initialId = searchParams.get('courseId') || String(list[0]?.id || '');
      if (initialId) {
        setForm((prev) => ({ ...prev, courseId: initialId }));
        setSelectedCourse(list.find((c) => String(c.id) === String(initialId)) || list[0] || null);
      }
    });
  }, [searchParams]);

  const handleCourseChange = (id) => {
    setForm((prev) => ({ ...prev, courseId: id }));
    setSelectedCourse(courses.find((c) => String(c.id) === String(id)) || null);
  };

  const payableNow = selectedCourse
    ? form.paymentOption === 'FULL'
      ? selectedCourse.fullAmount
      : selectedCourse.advanceAmount
    : 0;
  const remainingAfter = selectedCourse ? Math.max(0, selectedCourse.courseFee - payableNow) : 0;

  const handleAdmissionSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setPaymentError('');
    try {
      const res = await api.post('/admissions', {
        ...form,
        courseId: Number(form.courseId),
      });
      setAdmission(res.data.admission);
      showToast(`Admission ${res.data.admission.registrationId} registered! Proceed to payment.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Please check all admission details.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const launchPayment = async () => {
    if (!admission) return;
    setPaymentProcessing(true);
    setPaymentError('');
    try {
      const orderRes = await api.post('/payments/create-order', {
        admissionId: admission.id,
        paymentType: admission.paymentOption,
      });
      const order = orderRes.data.order;

      // Real Razorpay Checkout when live/test Razorpay credentials are configured
      if (order.mode === 'RAZORPAY' && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'SKILLNOVA',
          description: order.courseTitle,
          order_id: order.orderId,
          prefill: {
            name: order.applicantName,
            email: order.applicantEmail,
            contact: order.applicantPhone,
          },
          handler: async (response) => {
            try {
              const verifyRes = await api.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              setReceipt(verifyRes.data.receipt);
              showToast('Payment verified and enrollment activated!', 'success');
            } catch (verErr) {
              setPaymentError(verErr.response?.data?.message || 'Signature verification failed.');
            } finally {
              setPaymentProcessing(false);
            }
          },
          modal: {
            ondismiss: async () => {
              await api.post('/payments/fail', {
                razorpay_order_id: order.orderId,
                reason: 'Checkout dismissed by applicant',
              });
              setPaymentError('Payment window closed before completion. You can retry safely.');
              setPaymentProcessing(false);
            },
          },
        });
        rzp.open();
        return;
      }

      // Sandbox Test Mode Checkout (when Razorpay key secrets are not yet set in env)
      const verifyRes = await api.post('/payments/verify', {
        razorpay_order_id: order.orderId,
        simulateSandbox: true,
      });
      setReceipt(verifyRes.data.receipt);
      showToast('Test-mode payment verified and receipt generated!', 'success');
      setPaymentProcessing(false);
    } catch (err) {
      setPaymentError(err.response?.data?.message || 'Failed to initiate payment order.');
      setPaymentProcessing(false);
    }
  };

  const simulateFailedPayment = async () => {
    if (!admission) return;
    setPaymentProcessing(true);
    try {
      const orderRes = await api.post('/payments/create-order', {
        admissionId: admission.id,
        paymentType: admission.paymentOption,
      });
      await api.post('/payments/fail', {
        razorpay_order_id: orderRes.data.order.orderId,
        reason: 'Simulated bank decline test',
      });
      setPaymentError('Payment declined by gateway (Test Failure Recorded). You may retry below.');
      showToast('Failed payment state recorded safely.', 'error');
    } finally {
      setPaymentProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeading
        eyebrow="ADMISSION & ENROLMENT"
        title="Apply for SKILLNOVA Program Admission"
        subtitle="Fees are fetched authoritatively from our PostgreSQL catalog. Choose Advance Seat Reservation or Full Course Payment."
      />

      {receipt ? (
        <Card className="mt-8 p-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h3 className="font-display text-2xl font-bold text-slate-900">Payment Verified & Admission Confirmed</h3>
              <p className="text-sm text-slate-600">Receipt #{receipt.receiptNumber}</p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-y border-slate-200 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Registration ID</dt>
              <dd className="font-mono font-bold text-slate-900">{receipt.registrationId}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Admission Status</dt>
              <dd><StatusText status={receipt.admissionStatus} /></dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Program</dt>
              <dd className="font-semibold text-slate-900">{receipt.courseTitle}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Payment ID</dt>
              <dd className="font-mono text-slate-800">{receipt.paymentId}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Amount Paid</dt>
              <dd className="font-mono font-bold text-emerald-700 tabular-nums">{formatINR(receipt.amountPaid)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Remaining Balance</dt>
              <dd className="font-mono font-bold text-slate-900 tabular-nums">{formatINR(receipt.remainingBalance)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => downloadReceiptPdf(receipt)}>
              <Download className="w-4 h-4" /> Download PDF Receipt
            </Button>
            <Button variant="navy" onClick={() => navigate(user ? '/student' : '/login')}>
              {user ? 'Go to Student Dashboard' : 'Sign In to Access Courses'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Admission Form or Payment Step */}
          <div className="lg:col-span-8">
            {!admission ? (
              <Card className="p-6 sm:p-8">
                <form onSubmit={handleAdmissionSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Selected Course *</label>
                    <select
                      required
                      value={form.courseId}
                      onChange={(e) => handleCourseChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} — {formatINR(c.courseFee)} ({c.duration})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        value={form.mobileNumber}
                        onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp Number *</label>
                      <input
                        type="tel"
                        required
                        value={form.whatsappNumber}
                        onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">College / University *</label>
                      <input
                        type="text"
                        required
                        value={form.collegeName}
                        onChange={(e) => setForm({ ...form, collegeName: e.target.value })}
                        placeholder="e.g. NIT Surathkal"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Department / Stream *</label>
                      <input
                        type="text"
                        required
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        placeholder="e.g. Computer Science"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Year of Study *</label>
                      <select
                        value={form.yearOfStudy}
                        onChange={(e) => setForm({ ...form, yearOfStudy: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        <option>1st Year</option>
                        <option>2nd Year</option>
                        <option>3rd Year</option>
                        <option>Final Year (4th Year)</option>
                        <option>Graduate / Working Professional</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">State *</label>
                      <input
                        type="text"
                        required
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        placeholder="e.g. Karnataka"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Learning Mode *</label>
                      <select
                        value={form.learningPreference}
                        onChange={(e) => setForm({ ...form, learningPreference: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        <option>Live Online Cohort</option>
                        <option>Hybrid Lab Cohort</option>
                        <option>Weekend Mentor Track</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Payment Option *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, paymentOption: 'ADVANCE' })}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          form.paymentOption === 'ADVANCE'
                            ? 'border-violet-600 bg-violet-50/60 ring-1 ring-violet-600'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-900">Advance Seat Reservation</p>
                        <p className="font-mono text-base font-bold text-violet-700 mt-1 tabular-nums">
                          {formatINR(selectedCourse?.advanceAmount)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Pay remaining balance before cohort kickoff</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, paymentOption: 'FULL' })}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          form.paymentOption === 'FULL'
                            ? 'border-violet-600 bg-violet-50/60 ring-1 ring-violet-600'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-900">Full Course Payment</p>
                        <p className="font-mono text-base font-bold text-violet-700 mt-1 tabular-nums">
                          {formatINR(selectedCourse?.fullAmount)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Zero remaining balance · Immediate full clearance</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Optional Note</label>
                    <textarea
                      rows={2}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Scholarship code or preferred start batch..."
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
                    />
                  </div>

                  <Button type="submit" size="lg" loading={submitting} className="w-full">
                    Register Admission & Continue to Payment
                  </Button>
                </form>
              </Card>
            ) : (
              <Card className="p-6 sm:p-8">
                <div className="flex items-center justify-between flex-wrap gap-3 pb-5 border-b border-slate-200">
                  <div>
                    <p className="font-mono text-xs text-violet-700">REGISTRATION ID: {admission.registrationId}</p>
                    <h3 className="font-display text-xl font-bold text-slate-900 mt-1">
                      Complete Razorpay Payment Verification
                    </h3>
                  </div>
                  <StatusText status={admission.status} />
                </div>

                {paymentError && (
                  <div className="mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-sm text-rose-800">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Applicant</span>
                    <span className="font-medium text-slate-900">{admission.fullName} ({admission.email})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Selected Course</span>
                    <span className="font-medium text-slate-900">{admission.courseTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Mode</span>
                    <span className="font-mono font-medium text-slate-900">{admission.paymentOption}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-slate-100 text-base font-bold">
                    <span className="text-slate-900">Amount Payable Now</span>
                    <span className="font-mono text-violet-700 tabular-nums">{formatINR(admission.payableAmount)}</span>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Button size="lg" loading={paymentProcessing} onClick={launchPayment}>
                    <CreditCard className="w-4 h-4" />
                    Pay {formatINR(admission.payableAmount)} via Razorpay
                  </Button>
                  <Button size="lg" variant="secondary" disabled={paymentProcessing} onClick={simulateFailedPayment}>
                    Test Failed Payment Flow
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Authoritative Fee Summary Sidebar */}
          <div className="lg:col-span-4">
            <Card className="p-6 sticky top-24">
              <div className="flex items-center gap-2 text-xs font-mono text-violet-700 mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span>VERIFIED SERVER FEE SUMMARY</span>
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                {selectedCourse?.title || 'Select a Program'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {selectedCourse?.categoryName} · {selectedCourse?.duration}
              </p>

              <dl className="mt-5 pt-4 border-t border-slate-200 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Total Course Fee</dt>
                  <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatINR(selectedCourse?.courseFee)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Selected Payment ({form.paymentOption})</dt>
                  <dd className="font-mono font-bold text-violet-700 tabular-nums">{formatINR(payableNow)}</dd>
                </div>
                <div className="flex justify-between pt-3 border-t border-slate-100">
                  <dt className="text-slate-600 font-medium">Remaining Balance</dt>
                  <dd className="font-mono font-bold text-slate-900 tabular-nums">{formatINR(remainingAfter)}</dd>
                </div>
              </dl>

              <p className="mt-5 text-xs text-slate-500 leading-relaxed">
                All amounts are computed exclusively from database course pricing and verified cryptographically via Razorpay HMAC-SHA256 signatures.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
