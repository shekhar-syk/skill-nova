import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Compass, Mail, MapPin, Phone } from 'lucide-react';
import { Button, Card, SectionHeading } from '../../components/DesignSystem.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [courses, setCourses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    courseId: searchParams.get('courseId') || '',
    courseInterest: searchParams.get('course') || '',
    learningPreference: 'Live Online Cohort',
    message: '',
  });

  useEffect(() => {
    api.get('/courses?limit=60').then((res) => setCourses(res.data.courses || [])).catch(() => {});
  }, []);

  const handleCourseSelect = (e) => {
    const val = e.target.value;
    const found = courses.find((c) => String(c.id) === val);
    setForm((prev) => ({
      ...prev,
      courseId: val,
      courseInterest: found ? found.title : prev.courseInterest,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (form.message.trim().length < 10) {
      setErrorMsg('Please include at least 10 characters in your message.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/enquiries', {
        fullName: form.fullName,
        email: form.email,
        mobileNumber: form.mobileNumber,
        courseId: form.courseId ? Number(form.courseId) : null,
        courseInterest: form.courseInterest || 'General Program Guidance',
        learningPreference: form.learningPreference,
        message: form.message,
      });
      setSubmitted(true);
      showToast('Enquiry submitted successfully! An advisor will reach out shortly.', 'success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to submit enquiry. Please verify all fields.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeading
        eyebrow="ADMISSIONS & COUNSELLING"
        title="Contact SKILLNOVA Academic Advisors"
        subtitle="Request syllabus breakdowns, cohort schedules, fee installment details, or internship guidance."
      />

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <Card className="p-6 sm:p-8">
            {submitted ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h3 className="font-display text-2xl font-bold text-slate-900 mt-4">Enquiry Received</h3>
                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                  Your enquiry has been saved and routed to our admissions team. Check your inbox for confirmation.
                </p>
                <Button
                  className="mt-6"
                  onClick={() => {
                    setSubmitted(false);
                    setForm({
                      fullName: '',
                      email: '',
                      mobileNumber: '',
                      courseId: '',
                      courseInterest: '',
                      learningPreference: 'Live Online Cohort',
                      message: '',
                    });
                  }}
                >
                  Send Another Enquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {errorMsg && (
                  <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Aarav Nair"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="aarav@example.com"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
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
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Learning Preference *</label>
                    <select
                      value={form.learningPreference}
                      onChange={(e) => setForm({ ...form, learningPreference: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
                    >
                      <option value="Live Online Cohort">Live Online Cohort</option>
                      <option value="Weekend Mentor Track">Weekend Mentor Track</option>
                      <option value="Hybrid Lab Cohort">Hybrid Lab Cohort</option>
                      <option value="Fast-Track Self-Paced + Mentorship">Fast-Track + Mentorship</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Course Interested In *</label>
                  <select
                    value={form.courseId}
                    onChange={handleCourseSelect}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
                  >
                    <option value="">Select a course or write below...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.categoryName})
                      </option>
                    ))}
                  </select>
                  {!form.courseId && (
                    <input
                      type="text"
                      required
                      value={form.courseInterest}
                      onChange={(e) => setForm({ ...form, courseInterest: e.target.value })}
                      placeholder="e.g. Full Stack JavaScript Engineering or Career Guidance"
                      className="mt-2 w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Message / Questions *</label>
                  <textarea
                    rows={4}
                    required
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Share your background, target role, or preferred batch start date..."
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>

                <Button type="submit" size="lg" loading={submitting} className="w-full sm:w-auto">
                  Submit Enquiry
                </Button>
              </form>
            )}
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-5">
          <Card className="p-6">
            <h3 className="font-display text-lg font-bold text-slate-900">Academic Support Desk</h3>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-violet-700 mt-1 shrink-0" />
                <div>
                  <p className="font-medium text-slate-900">Email Admissions</p>
                  <p>admissions@skillnova.edu</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-violet-700 mt-1 shrink-0" />
                <div>
                  <p className="font-medium text-slate-900">Counsellor Helpline</p>
                  <p>+91 80 4192 8800 (Mon–Sat, 9 AM – 8 PM IST)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-violet-700 mt-1 shrink-0" />
                <div>
                  <p className="font-medium text-slate-900">Campus & Innovation Studio</p>
                  <p>Level 7, Prestige Tech Park, Outer Ring Road, Bengaluru 560103</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-[#0A0F24] text-white border-slate-800 space-y-3">
            <p className="font-mono text-xs text-violet-300 uppercase tracking-wider">INTERACTIVE MAP</p>
            <h3 className="font-display text-lg font-bold">Explore Campus & Tech Hub Map</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              View all 4 SKILLNOVA campuses, calculate driving or transit directions, and query nearby coworking hubs and metro stations.
            </p>
            <Link
              to="/campus-map"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white"
            >
              <Compass className="w-4 h-4" /> Open Campus Map
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
