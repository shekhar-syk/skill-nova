import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Briefcase,
  Compass,
  CreditCard,
  Download,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Card, Loader, Modal, StatusText } from '../../components/DesignSystem.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import { api } from '../../services/api.js';
import { formatDate, formatINR } from '../../utils/formatters.js';

export default function AdminDashboard() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState(null);
  const [aiAnalytics, setAiAnalytics] = useState(null);
  const [gamAnalytics, setGamAnalytics] = useState(null);
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [students, setStudents] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cms, setCms] = useState({ testimonials: [], faqs: [], settings: {} });

  // Upgrade state
  const [roadmaps, setRoadmaps] = useState([]);
  const [roadmapForm, setRoadmapForm] = useState({
    title: '',
    roleSummary: '',
    description: '',
    difficulty: 'Intermediate',
    estimatedWeeks: 16,
  });
  const [stepModalRoadmap, setStepModalRoadmap] = useState(null);
  const [stepForm, setStepForm] = useState({
    skillCategory: 'Core Engineering',
    title: '',
    description: '',
    recommendedCourseId: '',
    estimatedHours: 12,
    projectTask: '',
  });

  const [liveSessions, setLiveSessions] = useState([]);
  const [sessionForm, setSessionForm] = useState({
    courseId: '',
    title: '',
    description: '',
    meetingUrl: 'https://meet.google.com/skillnova-cohort',
    meetingPlatform: 'Google Meet',
    scheduledAt: '2026-12-18T18:00',
    durationMinutes: 60,
  });

  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [companyForm, setCompanyForm] = useState({ name: '', industry: '', location: '', websiteUrl: '', description: '' });
  const [jobForm, setJobForm] = useState({
    companyId: '',
    title: '',
    opportunityType: 'JOB',
    location: 'Bengaluru / Hybrid',
    workMode: 'Hybrid',
    stipendOrCtc: '8 - 12 LPA',
    eligibility: 'SkillNova Graduates',
    requiredSkills: 'Java, Spring Boot, SQL',
    description: '',
    applicationDeadline: '2026-12-31',
  });

  const [modQueue, setModQueue] = useState({ reportedDiscussions: [], reportedReplies: [] });
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', audience: 'ALL_STUDENTS', courseId: '' });
  const [assignCourseTarget, setAssignCourseTarget] = useState({});

  // Curriculum Modal per course
  const [curriculumCourse, setCurriculumCourse] = useState(null);
  const [curriculumDetail, setCurriculumDetail] = useState(null);
  const [newModForm, setNewModForm] = useState({ title: '', description: '' });
  const [newLesForm, setNewLesForm] = useState({ moduleId: '', title: '', lessonType: 'VIDEO', durationMinutes: 35, content: '' });

  const [studentSearch, setStudentSearch] = useState('');
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');

  // Course Editor Modal
  const [courseModal, setCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({
    title: '',
    shortSummary: '',
    description: '',
    categoryId: '',
    instructorId: '',
    thumbnailUrl: '/src/assets/images/course_fullstack_cloud_1795184321302.jpg',
    technologiesText: 'React, Node.js, PostgreSQL',
    skillLevel: 'Intermediate',
    duration: '12 Weeks',
    durationWeeks: 12,
    courseFee: 28000,
    advanceAmount: 5500,
    outcomesText: 'Build production applications\nPass technical interviews',
    status: 'PUBLISHED',
    featured: false,
  });

  // Instructor Modal
  const [instructorModal, setInstructorModal] = useState(false);
  const [instForm, setInstForm] = useState({
    fullName: '',
    email: '',
    password: 'SkillNova@Mentor2026',
    headline: '',
    companyBackground: '',
    yearsExperience: 7,
  });

  // Enquiry Note Modal
  const [noteEnquiry, setNoteEnquiry] = useState(null);
  const [noteText, setNoteText] = useState('');

  // CMS Forms
  const [cmsSettings, setCmsSettings] = useState({});
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', category: 'General' });
  const [newTestimonial, setNewTestimonial] = useState({
    studentName: '',
    roleTitle: '',
    companyName: '',
    courseTitle: '',
    quote: '',
    outcomeMetric: '',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        ov,
        aiAn,
        gamAn,
        crs,
        cats,
        stu,
        inst,
        enq,
        adm,
        pay,
        cmsRes,
        rmRes,
        lsRes,
        compRes,
        jobRes,
        appRes,
        modRes,
      ] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/ai-analytics'),
        api.get('/admin/gamification-analytics'),
        api.get('/courses?includeAll=true&limit=100'),
        api.get('/categories'),
        api.get('/admin/students'),
        api.get('/admin/instructors'),
        api.get('/enquiries'),
        api.get('/admissions'),
        api.get('/payments'),
        api.get('/public/cms'),
        api.get('/roadmaps'),
        api.get('/live-sessions'),
        api.get('/placements/companies'),
        api.get('/placements/jobs?status=ALL'),
        api.get('/admin/placements/applications'),
        api.get('/community/moderation'),
      ]);
      setOverview(ov.data);
      setAiAnalytics(aiAn.data);
      setGamAnalytics(gamAn.data);
      setCourses(crs.data.courses || []);
      setCategories(cats.data.categories || []);
      setStudents(stu.data.students || []);
      setInstructors(inst.data.instructors || []);
      setEnquiries(enq.data.enquiries || []);
      setAdmissions(adm.data.admissions || []);
      setPayments(pay.data.payments || []);
      setCms(cmsRes.data);
      setCmsSettings(cmsRes.data.settings || {});
      setRoadmaps(rmRes.data.roadmaps || []);
      setLiveSessions(lsRes.data.sessions || []);
      setCompanies(compRes.data.companies || []);
      setJobs(jobRes.data.opportunities || []);
      setApplications(appRes.data.applications || []);
      setModQueue(modRes.data);
      if (crs.data.courses?.[0] && !sessionForm.courseId) {
        setSessionForm((p) => ({ ...p, courseId: String(crs.data.courses[0].id) }));
      }
      if (compRes.data.companies?.[0] && !jobForm.companyId) {
        setJobForm((p) => ({ ...p, companyId: String(compRes.data.companies[0].id) }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load admin console.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openCourseEditor = (course = null) => {
    if (course) {
      setEditingCourse(course);
      setCourseForm({
        title: course.title,
        shortSummary: course.shortSummary,
        description: course.description,
        categoryId: String(course.categoryId),
        instructorId: course.instructorId ? String(course.instructorId) : '',
        thumbnailUrl: course.thumbnailUrl,
        technologiesText: (course.technologies || []).join(', '),
        skillLevel: course.skillLevel,
        duration: course.duration,
        durationWeeks: course.durationWeeks,
        courseFee: course.courseFee,
        advanceAmount: course.advanceAmount,
        outcomesText: (course.learningOutcomes || []).join('\n'),
        status: course.status,
        featured: Boolean(course.featured),
      });
    } else {
      setEditingCourse(null);
      setCourseForm({
        title: '',
        shortSummary: '',
        description: '',
        categoryId: String(categories[0]?.id || ''),
        instructorId: String(instructors[0]?.id || ''),
        thumbnailUrl: '/src/assets/images/course_fullstack_cloud_1795184321302.jpg',
        technologiesText: 'React, Node.js, PostgreSQL',
        skillLevel: 'Intermediate',
        duration: '12 Weeks',
        durationWeeks: 12,
        courseFee: 28000,
        advanceAmount: 5500,
        outcomesText: 'Build production architectures\nComplete capstone project',
        status: 'PUBLISHED',
        featured: false,
      });
    }
    setCourseModal(true);
  };

  const handleCourseSave = async (e) => {
    e.preventDefault();
    const payload = {
      title: courseForm.title,
      shortSummary: courseForm.shortSummary,
      description: courseForm.description,
      categoryId: Number(courseForm.categoryId),
      instructorId: courseForm.instructorId ? Number(courseForm.instructorId) : null,
      thumbnailUrl: courseForm.thumbnailUrl,
      technologies: courseForm.technologiesText.split(',').map((s) => s.trim()).filter(Boolean),
      skillLevel: courseForm.skillLevel,
      duration: courseForm.duration,
      durationWeeks: Number(courseForm.durationWeeks),
      courseFee: Number(courseForm.courseFee),
      advanceAmount: Number(courseForm.advanceAmount),
      learningOutcomes: courseForm.outcomesText.split('\n').map((s) => s.trim()).filter(Boolean),
      status: courseForm.status,
      featured: Boolean(courseForm.featured),
    };
    try {
      if (editingCourse) {
        await api.put(`/courses/${editingCourse.id}`, payload);
        showToast('Course updated.', 'success');
      } else {
        await api.post('/courses', payload);
        showToast('New course created.', 'success');
      }
      setCourseModal(false);
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'Course save failed.', 'error');
    }
  };

  const openCurriculumModal = async (course) => {
    setCurriculumCourse(course);
    try {
      const res = await api.get(`/courses/${course.id}`);
      setCurriculumDetail(res.data.course);
      const firstMod = res.data.course?.modules?.[0]?.id;
      setNewLesForm((p) => ({ ...p, moduleId: firstMod ? String(firstMod) : '' }));
    } catch {
      showToast('Unable to load course curriculum.', 'error');
    }
  };

  const addCurriculumModule = async (e) => {
    e.preventDefault();
    if (!curriculumCourse) return;
    try {
      await api.post(`/courses/${curriculumCourse.id}/modules`, newModForm);
      setNewModForm({ title: '', description: '' });
      showToast('Module added.', 'success');
      openCurriculumModal(curriculumCourse);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add module.', 'error');
    }
  };

  const addCurriculumLesson = async (e) => {
    e.preventDefault();
    if (!newLesForm.moduleId) return;
    try {
      await api.post(`/modules/${newLesForm.moduleId}/lessons`, {
        title: newLesForm.title,
        lessonType: newLesForm.lessonType,
        durationMinutes: Number(newLesForm.durationMinutes),
        content: newLesForm.content,
      });
      setNewLesForm((p) => ({ ...p, title: '', content: '' }));
      showToast('Lesson added to module.', 'success');
      openCurriculumModal(curriculumCourse);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add lesson.', 'error');
    }
  };

  const toggleCourseStatus = async (c) => {
    const next = c.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    await api.patch(`/courses/${c.id}/status`, { status: next });
    showToast(`Course marked ${next}`, 'success');
    loadAll();
  };

  const deleteCourse = async (id) => {
    const res = await api.delete(`/courses/${id}`);
    showToast(res.data.message || 'Course removed.', 'info');
    loadAll();
  };

  const handleThumbUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'skillnova/thumbnails');
    try {
      const res = await api.post('/uploads', fd);
      setCourseForm((p) => ({ ...p, thumbnailUrl: res.data.file.url }));
      showToast('Thumbnail uploaded.', 'success');
    } catch {
      showToast('Thumbnail upload failed.', 'error');
    }
  };

  const toggleStudentActive = async (stu) => {
    await api.patch(`/admin/users/${stu.id}/active`, { isActive: !stu.is_active });
    showToast(`Student ${stu.is_active ? 'deactivated' : 'activated'}.`, 'success');
    loadAll();
  };

  const createInstructor = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/instructors', instForm);
      showToast('Instructor added.', 'success');
      setInstructorModal(false);
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add instructor.', 'error');
    }
  };

  const assignCourseToInstructor = async (instructorId) => {
    const courseId = assignCourseTarget[instructorId];
    if (!courseId) return;
    try {
      await api.patch(`/admin/instructors/${instructorId}/assign-course`, { courseId: Number(courseId) });
      showToast('Course assigned to instructor.', 'success');
      loadAll();
    } catch {
      showToast('Failed to assign course.', 'error');
    }
  };

  const updateEnquiryStatus = async (id, status) => {
    await api.patch(`/enquiries/${id}`, { status });
    showToast('Enquiry status updated.', 'success');
    loadAll();
  };

  const addEnquiryNote = async (e) => {
    e.preventDefault();
    await api.post(`/enquiries/${noteEnquiry.id}/notes`, { note: noteText });
    setNoteText('');
    setNoteEnquiry(null);
    showToast('Internal counsellor note saved.', 'success');
    loadAll();
  };

  const updateAdmissionStatus = async (id, status) => {
    await api.patch(`/admissions/${id}/status`, { status });
    showToast(`Admission marked ${status}.`, 'success');
    loadAll();
  };

  const exportCsv = async (type) => {
    try {
      const res = await api.get(`/analytics/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `skillnova-${type}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`Exported ${type} CSV report.`, 'success');
    } catch {
      showToast('CSV export failed.', 'error');
    }
  };

  const saveCmsSettings = async (e) => {
    e.preventDefault();
    await api.put('/admin/cms/settings', cmsSettings);
    showToast('Homepage & contact CMS settings saved.', 'success');
    loadAll();
  };

  const addFaq = async (e) => {
    e.preventDefault();
    await api.post('/admin/cms/faqs', newFaq);
    setNewFaq({ question: '', answer: '', category: 'General' });
    showToast('FAQ added.', 'success');
    loadAll();
  };

  const addTestimonial = async (e) => {
    e.preventDefault();
    await api.post('/admin/cms/testimonials', newTestimonial);
    setNewTestimonial({ studentName: '', roleTitle: '', companyName: '', courseTitle: '', quote: '', outcomeMetric: '' });
    showToast('Testimonial added.', 'success');
    loadAll();
  };

  // Upgrade handlers
  const createRoadmap = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/roadmaps', {
        ...roadmapForm,
        estimatedWeeks: Number(roadmapForm.estimatedWeeks),
        skillCategories: ['Core Foundations', 'Production Projects', 'Interview Readiness'],
      });
      showToast('Career roadmap created!', 'success');
      setRoadmapForm({ title: '', roleSummary: '', description: '', difficulty: 'Intermediate', estimatedWeeks: 16 });
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create roadmap.', 'error');
    }
  };

  const addRoadmapStep = async (e) => {
    e.preventDefault();
    if (!stepModalRoadmap) return;
    try {
      await api.post(`/admin/roadmaps/${stepModalRoadmap.id}/steps`, stepForm);
      showToast('Step added to career roadmap.', 'success');
      setStepModalRoadmap(null);
      setStepForm({ skillCategory: 'Core Engineering', title: '', description: '', recommendedCourseId: '', estimatedHours: 12, projectTask: '' });
      loadAll();
    } catch {
      showToast('Failed to add step.', 'error');
    }
  };

  const deleteRoadmap = async (id) => {
    await api.delete(`/admin/roadmaps/${id}`);
    showToast('Roadmap removed.', 'info');
    loadAll();
  };

  const scheduleAdminLiveSession = async (e) => {
    e.preventDefault();
    try {
      await api.post('/live-sessions', sessionForm);
      showToast('Live class scheduled & students notified.', 'success');
      setSessionForm((p) => ({ ...p, title: '', description: '' }));
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to schedule session.', 'error');
    }
  };

  const cancelSession = async (id) => {
    await api.patch(`/live-sessions/${id}/cancel`, { reason: 'Cancelled by academy administration' });
    showToast('Live session cancelled.', 'info');
    loadAll();
  };

  const createCompany = async (e) => {
    e.preventDefault();
    await api.post('/admin/placements/companies', companyForm);
    setCompanyForm({ name: '', industry: '', location: '', websiteUrl: '', description: '' });
    showToast('Hiring partner company added.', 'success');
    loadAll();
  };

  const createJob = async (e) => {
    e.preventDefault();
    await api.post('/admin/placements/jobs', jobForm);
    setJobForm((p) => ({ ...p, title: '', description: '' }));
    showToast('Placement opportunity published.', 'success');
    loadAll();
  };

  const toggleJobStatus = async (job) => {
    const next = job.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    await api.patch(`/admin/placements/jobs/${job.id}/status`, { status: next });
    showToast(`Opportunity marked ${next}.`, 'success');
    loadAll();
  };

  const updateApplicationStatus = async (appId, status) => {
    await api.patch(`/admin/placements/applications/${appId}/status`, { status });
    showToast(`Application updated to ${status}.`, 'success');
    loadAll();
  };

  const moderateItem = async (targetType, targetId, action) => {
    await api.patch('/community/moderate', { targetType, targetId, action });
    showToast(`Moderation action (${action}) applied.`, 'success');
    loadAll();
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/notifications/broadcast', broadcastForm);
      showToast(res.data.message, 'success');
      setBroadcastForm({ title: '', message: '', audience: 'ALL_STUDENTS', courseId: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Broadcast failed.', 'error');
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
    { id: 'courses', label: 'Courses & Curriculum', icon: BookOpen },
    { id: 'roadmaps', label: 'Career Roadmaps', icon: Compass },
    { id: 'live-sessions', label: 'Live Sessions', icon: Video },
    { id: 'placements', label: 'Placements & Jobs', icon: Briefcase },
    { id: 'moderation', label: 'Moderation & Alerts', icon: ShieldAlert },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'instructors', label: 'Instructors', icon: Users },
    { id: 'enquiries', label: 'Enquiries CRM', icon: MessageSquare },
    { id: 'admissions', label: 'Admissions', icon: FileCheck },
    { id: 'payments', label: 'Payments & Reports', icon: CreditCard },
    { id: 'cms', label: 'Website CMS', icon: Settings },
  ];

  const kpis = overview?.kpis || {};
  const filteredStudents = students.filter(
    (s) =>
      !studentSearch.trim() ||
      s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );
  const filteredEnquiries = enquiries.filter((e) => !enquiryStatusFilter || e.status === enquiryStatusFilter);
  const filteredPayments = payments.filter((p) => !paymentStatusFilter || p.status === paymentStatusFilter);

  return (
    <DashboardLayout
      title="SKILLNOVA Operations & Admin Console"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {loading ? (
        <Loader label="Loading live PostgreSQL metrics..." />
      ) : (
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Total Revenue', formatINR(kpis.totalRevenue)],
                  ['Total Students', kpis.totalStudents],
                  ['Active Courses', kpis.totalCourses],
                  ['Pending Enquiries', kpis.pendingEnquiries],
                  ['Total Enrollments', kpis.totalEnrollments],
                  ['AI Tutor Chats', aiAnalytics?.totals?.conversations || 0],
                  ['Total XP Awarded', gamAnalytics?.summary?.totalXpAwarded || 0],
                  ['Badges Unlocked', gamAnalytics?.summary?.badgesUnlocked || 0],
                ].map(([label, val]) => (
                  <Card key={label} className="p-5">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-mono text-2xl font-bold text-slate-900 mt-2 tabular-nums">{val ?? 0}</p>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-base font-bold text-slate-900">Revenue Trend (INR)</h3>
                    <Button size="sm" variant="secondary" onClick={() => exportCsv('payments')}>
                      <Download className="w-3.5 h-3.5" /> CSV
                    </Button>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overview?.monthlySeries || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#6d28d9" fill="#ddd6fe" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-base font-bold text-slate-900">Course Popularity by Track</h3>
                    <Button size="sm" variant="secondary" onClick={() => exportCsv('course-completion')}>
                      <Download className="w-3.5 h-3.5" /> Completion CSV
                    </Button>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview?.categoryPopularity || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="enrollments" fill="#0A0F24" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-3">
                    AI Assistant Usage by Mode
                  </h3>
                  {(aiAnalytics?.byMode || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No AI assistant sessions recorded yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {aiAnalytics.byMode.map((m) => (
                        <div key={m.mode} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                          <span className="font-mono text-xs text-slate-700">{m.mode}</span>
                          <span className="font-mono font-bold text-violet-700">{m.count} prompts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-3">
                    Gamification XP Distribution
                  </h3>
                  <div className="space-y-2.5">
                    {(gamAnalytics?.byEventType || []).map((ev) => (
                      <div key={ev.eventType} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                        <span className="font-mono text-xs text-slate-700">{ev.eventType}</span>
                        <span className="font-mono text-xs text-slate-900">
                          {ev.count} events · <strong className="text-emerald-700">{ev.xp} XP</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}

          {activeTab === 'courses' && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Manage Courses ({courses.length})
                </h3>
                <Button onClick={() => openCourseEditor(null)}>
                  <Plus className="w-4 h-4" /> Add New Course
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4">Title</th>
                      <th className="py-2.5 pr-4">Category</th>
                      <th className="py-2.5 pr-4 text-right">Fee</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courses.map((c) => (
                      <tr key={c.id}>
                        <td className="py-3 pr-4 font-medium max-w-xs truncate">{c.title}</td>
                        <td className="py-3 pr-4 text-xs text-slate-600">{c.categoryName}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatINR(c.courseFee)}</td>
                        <td className="py-3 pr-4"><StatusText status={c.status} /></td>
                        <td className="py-3 flex flex-wrap items-center gap-2.5">
                          <button type="button" onClick={() => openCurriculumModal(c)} className="text-xs font-semibold text-slate-900 hover:underline cursor-pointer">
                            Curriculum
                          </button>
                          <button type="button" onClick={() => openCourseEditor(c)} className="text-xs font-semibold text-violet-700 hover:underline cursor-pointer">
                            Edit
                          </button>
                          <button type="button" onClick={() => toggleCourseStatus(c)} className="text-xs font-semibold text-slate-700 hover:underline cursor-pointer">
                            {c.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                          </button>
                          <button type="button" onClick={() => deleteCourse(c.id)} className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'roadmaps' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-5 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Create Career Roadmap</h3>
                <form onSubmit={createRoadmap} className="space-y-3">
                  <input type="text" required placeholder="Roadmap Title (e.g. Cybersecurity Engineer)" value={roadmapForm.title} onChange={(e) => setRoadmapForm({ ...roadmapForm, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  <input type="text" required placeholder="Role Summary" value={roadmapForm.roleSummary} onChange={(e) => setRoadmapForm({ ...roadmapForm, roleSummary: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  <textarea rows={3} required placeholder="Full roadmap description..." value={roadmapForm.description} onChange={(e) => setRoadmapForm({ ...roadmapForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={roadmapForm.difficulty} onChange={(e) => setRoadmapForm({ ...roadmapForm, difficulty: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                      <option value="Beginner to Job-Ready">Beginner to Job-Ready</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Intermediate to Advanced">Intermediate to Advanced</option>
                    </select>
                    <input type="number" min={4} max={52} value={roadmapForm.estimatedWeeks} onChange={(e) => setRoadmapForm({ ...roadmapForm, estimatedWeeks: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  </div>
                  <Button type="submit" className="w-full">Publish Roadmap</Button>
                </form>
              </Card>

              <Card className="lg:col-span-7 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">
                  Career Roadmaps ({roadmaps.length})
                </h3>
                <div className="space-y-3">
                  {roadmaps.map((r) => (
                    <div key={r.id} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs text-violet-700">{r.estimatedWeeks} WEEKS · {r.stepsCount} STEPS</p>
                        <h4 className="font-display text-base font-bold text-slate-900">{r.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{r.roleSummary}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="secondary" onClick={() => setStepModalRoadmap(r)}>
                          Add Step
                        </Button>
                        <button type="button" onClick={() => deleteRoadmap(r.id)} className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'live-sessions' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-5 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Schedule Live Class</h3>
                <form onSubmit={scheduleAdminLiveSession} className="space-y-3">
                  <select value={sessionForm.courseId} onChange={(e) => setSessionForm({ ...sessionForm, courseId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <input type="text" required placeholder="Session Title" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  <textarea rows={2} required placeholder="Session Agenda" value={sessionForm.description} onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  <input type="url" required placeholder="https://meet.google.com/..." value={sessionForm.meetingUrl} onChange={(e) => setSessionForm({ ...sessionForm, meetingUrl: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  <input type="datetime-local" required value={sessionForm.scheduledAt} onChange={(e) => setSessionForm({ ...sessionForm, scheduledAt: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  <Button type="submit" className="w-full">Schedule Session</Button>
                </form>
              </Card>

              <Card className="lg:col-span-7 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">
                  All Cohort Live Sessions ({liveSessions.length})
                </h3>
                <div className="space-y-3">
                  {liveSessions.map((ls) => (
                    <div key={ls.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-violet-700">{ls.course_title} · {ls.attended_count || 0} attended</p>
                        <h4 className="font-display text-sm font-bold text-slate-900">{ls.title}</h4>
                        <p className="text-xs text-slate-500">{new Date(ls.scheduled_at).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusText status={ls.status} />
                        {ls.status === 'SCHEDULED' && (
                          <Button size="sm" variant="danger" onClick={() => cancelSession(ls.id)}>Cancel</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'placements' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-3">Add Partner Company</h3>
                  <form onSubmit={createCompany} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" required placeholder="Company Name" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                      <input type="text" required placeholder="Industry" value={companyForm.industry} onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    </div>
                    <input type="text" required placeholder="Location" value={companyForm.location} onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <textarea rows={2} required placeholder="Company Profile" value={companyForm.description} onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <Button size="sm" type="submit">Add Partner Company</Button>
                  </form>
                </Card>

                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-3">Post Job / Internship</h3>
                  <form onSubmit={createJob} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={jobForm.companyId} onChange={(e) => setJobForm({ ...jobForm, companyId: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <select value={jobForm.opportunityType} onChange={(e) => setJobForm({ ...jobForm, opportunityType: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                        <option value="JOB">Full-Time Job</option>
                        <option value="INTERNSHIP">Internship</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" required placeholder="Job Title" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                      <input type="text" required placeholder="Stipend / CTC" value={jobForm.stipendOrCtc} onChange={(e) => setJobForm({ ...jobForm, stipendOrCtc: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    </div>
                    <input type="text" required placeholder="Required Skills (comma separated)" value={jobForm.requiredSkills} onChange={(e) => setJobForm({ ...jobForm, requiredSkills: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <textarea rows={2} required placeholder="Role description..." value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <Button size="sm" type="submit">Publish Opportunity</Button>
                  </form>
                </Card>
              </div>

              <Card className="p-6">
                <h3 className="font-display text-base font-bold text-slate-900 mb-3">Active Opportunities ({jobs.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {jobs.map((j) => (
                    <div key={j.id} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-violet-700">{j.opportunity_type} · {j.company_name}</p>
                        <p className="font-semibold text-sm text-slate-900">{j.title}</p>
                        <p className="text-xs text-slate-500">{j.stipend_or_ctc} · {j.location}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusText status={j.status} />
                        <Button size="sm" variant="secondary" onClick={() => toggleJobStatus(j)}>
                          {j.status === 'OPEN' ? 'Close' : 'Reopen'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-display text-base font-bold text-slate-900 mb-4">Student Applications Pipeline ({applications.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Candidate</th>
                        <th className="py-2 pr-4">Role & Company</th>
                        <th className="py-2 pr-4">Resume</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2">Pipeline Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {applications.map((a) => (
                        <tr key={a.id}>
                          <td className="py-2.5 pr-4">
                            <p className="font-medium">{a.student_name}</p>
                            <p className="text-xs text-slate-500">{a.student_email}</p>
                          </td>
                          <td className="py-2.5 pr-4">{a.job_title} · {a.company_name}</td>
                          <td className="py-2.5 pr-4">
                            <a href={a.resume_url} target="_blank" rel="noreferrer" className="text-xs text-violet-700 underline">
                              {a.resume_filename || 'View Resume'}
                            </a>
                          </td>
                          <td className="py-2.5 pr-4"><StatusText status={a.status} /></td>
                          <td className="py-2.5">
                            <select
                              value={a.status}
                              onChange={(e) => updateApplicationStatus(a.id, e.target.value)}
                              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                            >
                              {['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'].map((st) => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'moderation' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-5 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-violet-600" /> Broadcast Platform Notification
                </h3>
                <form onSubmit={sendBroadcast} className="space-y-3">
                  <select
                    value={broadcastForm.audience}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, audience: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ALL_STUDENTS">All Students</option>
                    <option value="ALL_INSTRUCTORS">All Instructors</option>
                    <option value="ALL_USERS">All Registered Users</option>
                    <option value="COURSE_ENROLLED">Enrolled in Specific Course</option>
                  </select>
                  {broadcastForm.audience === 'COURSE_ENROLLED' && (
                    <select
                      required
                      value={broadcastForm.courseId}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, courseId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Select Course...</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    required
                    placeholder="Announcement Title"
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <textarea
                    rows={3}
                    required
                    placeholder="Broadcast message..."
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <Button type="submit" className="w-full">Deliver Broadcast</Button>
                </form>
              </Card>

              <Card className="lg:col-span-7 p-6 space-y-4">
                <h3 className="font-display text-lg font-bold text-slate-900">Community Moderation Queue</h3>
                {modQueue.reportedDiscussions.length === 0 && modQueue.reportedReplies.length === 0 ? (
                  <p className="text-sm text-slate-500">No flagged threads or replies awaiting moderation.</p>
                ) : (
                  <div className="space-y-3">
                    {modQueue.reportedDiscussions.map((d) => (
                      <div key={`d-${d.id}`} className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                        <p className="font-mono text-xs text-amber-800">FLAGGED DISCUSSION · {d.author_name}</p>
                        <p className="font-semibold text-sm">{d.title}</p>
                        <p className="text-xs text-slate-600">{d.content}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="sm" variant="secondary" onClick={() => moderateItem('DISCUSSION', d.id, 'DISMISS_REPORT')}>Dismiss</Button>
                          <Button size="sm" variant="secondary" onClick={() => moderateItem('DISCUSSION', d.id, d.is_hidden ? 'UNHIDE' : 'HIDE')}>
                            {d.is_hidden ? 'Unhide' : 'Hide'}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => moderateItem('DISCUSSION', d.id, 'DELETE')}>Delete</Button>
                        </div>
                      </div>
                    ))}
                    {modQueue.reportedReplies.map((r) => (
                      <div key={`r-${r.id}`} className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                        <p className="font-mono text-xs text-amber-800">FLAGGED REPLY · {r.author_name}</p>
                        <p className="text-xs text-slate-700">{r.content}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="sm" variant="secondary" onClick={() => moderateItem('REPLY', r.id, 'DISMISS_REPORT')}>Dismiss</Button>
                          <Button size="sm" variant="secondary" onClick={() => moderateItem('REPLY', r.id, r.is_hidden ? 'UNHIDE' : 'HIDE')}>
                            {r.is_hidden ? 'Unhide' : 'Hide'}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => moderateItem('REPLY', r.id, 'DELETE')}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'students' && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <h3 className="font-display text-lg font-bold text-slate-900">Student Directory</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => exportCsv('student-performance')}>
                    <Download className="w-3.5 h-3.5" /> Performance CSV
                  </Button>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search student name or email..."
                    className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg w-64"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4 text-right">Enrollments</th>
                      <th className="py-2 pr-4 text-right">Total Paid</th>
                      <th className="py-2 pr-4">Account</th>
                      <th className="py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s) => (
                      <tr key={s.id}>
                        <td className="py-3 pr-4 font-medium">{s.full_name}</td>
                        <td className="py-3 pr-4 text-slate-600">{s.email}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{s.enrollment_count}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatINR(s.total_paid)}</td>
                        <td className="py-3 pr-4"><StatusText status={s.is_active ? 'ACTIVE' : 'ARCHIVED'} /></td>
                        <td className="py-3">
                          <Button size="sm" variant="secondary" onClick={() => toggleStudentActive(s)}>
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'instructors' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold text-slate-900">Instructors & Course Assignment</h3>
                <Button onClick={() => setInstructorModal(true)}>
                  <Plus className="w-4 h-4" /> Add Instructor
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {instructors.map((inst) => (
                  <Card key={inst.id} className="p-5 space-y-3">
                    <div>
                      <h4 className="font-display text-base font-bold text-slate-900">{inst.full_name}</h4>
                      <p className="text-xs text-violet-700 font-medium">{inst.headline}</p>
                      <p className="text-xs text-slate-500 mt-1">{inst.email} · {inst.assigned_courses} assigned courses</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <select
                        value={assignCourseTarget[inst.id] || ''}
                        onChange={(e) => setAssignCourseTarget((p) => ({ ...p, [inst.id]: e.target.value }))}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">Assign course...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="secondary" onClick={() => assignCourseToInstructor(inst.id)}>
                        Assign
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'enquiries' && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <h3 className="font-display text-lg font-bold text-slate-900">Enquiry & Lead Pipeline</h3>
                <select
                  value={enquiryStatusFilter}
                  onChange={(e) => setEnquiryStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="FOLLOW_UP">FOLLOW_UP</option>
                  <option value="CONVERTED">CONVERTED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div className="space-y-4">
                {filteredEnquiries.map((enq) => (
                  <div key={enq.id} className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">
                          {enq.fullName} · {enq.mobileNumber} · {enq.email}
                        </p>
                        <p className="text-xs text-violet-700">{enq.courseInterest} ({enq.learningPreference})</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={enq.status}
                          onChange={(e) => updateEnquiryStatus(enq.id, e.target.value)}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONTACTED">CONTACTED</option>
                          <option value="FOLLOW_UP">FOLLOW_UP</option>
                          <option value="CONVERTED">CONVERTED</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                        <Button size="sm" variant="secondary" onClick={() => setNoteEnquiry(enq)}>
                          Add Note
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">{enq.message}</p>
                    {enq.notes?.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        {enq.notes.map((n) => (
                          <p key={n.id} className="text-xs text-slate-500">
                            <strong>{n.authorName}:</strong> {n.note}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'admissions' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold text-slate-900">Admission Applications</h3>
                <Button size="sm" variant="secondary" onClick={() => exportCsv('admissions')}>
                  <Download className="w-3.5 h-3.5" /> Export Admissions CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Reg ID</th>
                      <th className="py-2 pr-4">Applicant</th>
                      <th className="py-2 pr-4">Course</th>
                      <th className="py-2 pr-4 text-right">Paid</th>
                      <th className="py-2 pr-4 text-right">Balance</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {admissions.map((a) => (
                      <tr key={a.id}>
                        <td className="py-3 pr-4 font-mono text-xs">{a.registration_id}</td>
                        <td className="py-3 pr-4">
                          <p className="font-medium">{a.full_name}</p>
                          <p className="text-xs text-slate-500">{a.college_name}</p>
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-700">{a.course_title}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums text-emerald-700">{formatINR(a.amount_paid)}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatINR(a.remaining_balance)}</td>
                        <td className="py-3 pr-4"><StatusText status={a.status} /></td>
                        <td className="py-3 flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => updateAdmissionStatus(a.id, 'APPROVED')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => updateAdmissionStatus(a.id, 'REJECTED')}>
                            Reject
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'payments' && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <h3 className="font-display text-lg font-bold text-slate-900">Razorpay Transaction Ledger & Exports</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">All Transactions</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="CREATED">CREATED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                  <Button size="sm" variant="secondary" onClick={() => exportCsv('payments')}>
                    <Download className="w-3.5 h-3.5" /> Payments CSV
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => exportCsv('student-performance')}>
                    <Download className="w-3.5 h-3.5" /> Student Perf CSV
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => exportCsv('course-completion')}>
                    <Download className="w-3.5 h-3.5" /> Completion CSV
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Receipt</th>
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Course</th>
                      <th className="py-2 pr-4">Order / Payment ID</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 pr-4 font-mono text-xs">{p.receipt_number}</td>
                        <td className="py-3 pr-4">{p.student_name}</td>
                        <td className="py-3 pr-4 text-xs text-slate-600">{p.course_title}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                          {p.razorpay_order_id}
                          {p.razorpay_payment_id && ` · ${p.razorpay_payment_id}`}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono font-semibold tabular-nums">{formatINR(p.amount)}</td>
                        <td className="py-3"><StatusText status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'cms' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Homepage Banner & Contact Settings</h3>
                <form onSubmit={saveCmsSettings} className="space-y-4">
                  {[
                    ['announcement_banner', 'Announcement Banner'],
                    ['hero_headline', 'Hero Headline'],
                    ['contact_email', 'Admissions Email'],
                    ['contact_phone', 'Helpline Phone'],
                    ['contact_address', 'Campus Address'],
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                      <input
                        type="text"
                        value={cmsSettings[k] || ''}
                        onChange={(e) => setCmsSettings({ ...cmsSettings, [k]: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  ))}
                  <Button type="submit">Save Website Settings</Button>
                </form>
              </Card>

              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-3">Add Testimonial</h3>
                  <form onSubmit={addTestimonial} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" required placeholder="Student Name" value={newTestimonial.studentName} onChange={(e) => setNewTestimonial({ ...newTestimonial, studentName: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                      <input type="text" required placeholder="Role & Company" value={newTestimonial.companyName} onChange={(e) => setNewTestimonial({ ...newTestimonial, companyName: e.target.value, roleTitle: 'Engineer' })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    </div>
                    <input type="text" required placeholder="Course Completed" value={newTestimonial.courseTitle} onChange={(e) => setNewTestimonial({ ...newTestimonial, courseTitle: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <input type="text" required placeholder="Outcome Metric (e.g. Hired in 4 weeks)" value={newTestimonial.outcomeMetric} onChange={(e) => setNewTestimonial({ ...newTestimonial, outcomeMetric: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <textarea rows={2} required placeholder="Quote..." value={newTestimonial.quote} onChange={(e) => setNewTestimonial({ ...newTestimonial, quote: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <Button size="sm" type="submit">Add Testimonial</Button>
                  </form>
                </Card>

                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-3">Add FAQ</h3>
                  <form onSubmit={addFaq} className="space-y-3">
                    <input type="text" required placeholder="Question" value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <textarea rows={2} required placeholder="Answer" value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    <Button size="sm" type="submit">Add FAQ</Button>
                  </form>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Course Create/Edit Modal */}
      <Modal
        open={courseModal}
        onClose={() => setCourseModal(false)}
        title={editingCourse ? 'Edit Course' : 'Create New Course'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCourseSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Course Title *</label>
            <input type="text" required value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
              <select value={courseForm.categoryId} onChange={(e) => setCourseForm({ ...courseForm, categoryId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Instructor</label>
              <select value={courseForm.instructorId} onChange={(e) => setCourseForm({ ...courseForm, instructorId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Level</label>
              <select value={courseForm.skillLevel} onChange={(e) => setCourseForm({ ...courseForm, skillLevel: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duration</label>
              <input type="text" required value={courseForm.duration} onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Course Fee (INR)</label>
              <input type="number" required value={courseForm.courseFee} onChange={(e) => setCourseForm({ ...courseForm, courseFee: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Advance (INR)</label>
              <input type="number" required value={courseForm.advanceAmount} onChange={(e) => setCourseForm({ ...courseForm, advanceAmount: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Short Summary *</label>
            <input type="text" required value={courseForm.shortSummary} onChange={(e) => setCourseForm({ ...courseForm, shortSummary: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Description *</label>
            <textarea rows={3} required value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Technologies (comma separated)</label>
            <input type="text" required value={courseForm.technologiesText} onChange={(e) => setCourseForm({ ...courseForm, technologiesText: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Thumbnail URL or Upload</label>
            <div className="flex gap-2">
              <input type="text" required value={courseForm.thumbnailUrl} onChange={(e) => setCourseForm({ ...courseForm, thumbnailUrl: e.target.value })} className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <label className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                Upload
                <input type="file" accept="image/*" onChange={handleThumbUpload} className="hidden" />
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={courseForm.featured} onChange={(e) => setCourseForm({ ...courseForm, featured: e.target.checked })} />
            <span>Feature on Homepage</span>
          </label>
          <Button type="submit" className="w-full">
            {editingCourse ? 'Update Course' : 'Publish Course'}
          </Button>
        </form>
      </Modal>

      {/* Curriculum Manager Modal */}
      <Modal
        open={Boolean(curriculumCourse)}
        onClose={() => setCurriculumCourse(null)}
        title={`Curriculum · ${curriculumCourse?.title || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          {curriculumDetail?.modules?.map((m) => (
            <div key={m.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <p className="font-semibold text-sm text-slate-900">{m.title}</p>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                {m.lessons.map((l) => (
                  <li key={l.id}>· {l.title} ({l.lessonType}, {l.durationMinutes}m)</li>
                ))}
              </ul>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
            <form onSubmit={addCurriculumModule} className="space-y-2.5">
              <p className="font-display text-xs font-bold text-slate-900">Add Module</p>
              <input type="text" required placeholder="Module Title" value={newModForm.title} onChange={(e) => setNewModForm({ ...newModForm, title: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
              <input type="text" placeholder="Module Description" value={newModForm.description} onChange={(e) => setNewModForm({ ...newModForm, description: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
              <Button size="sm" type="submit" variant="navy">Create Module</Button>
            </form>

            <form onSubmit={addCurriculumLesson} className="space-y-2.5">
              <p className="font-display text-xs font-bold text-slate-900">Add Lesson</p>
              <select value={newLesForm.moduleId} onChange={(e) => setNewLesForm({ ...newLesForm, moduleId: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {(curriculumDetail?.modules || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              <input type="text" required placeholder="Lesson Title" value={newLesForm.title} onChange={(e) => setNewLesForm({ ...newLesForm, title: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
              <textarea rows={2} required placeholder="Lesson Content..." value={newLesForm.content} onChange={(e) => setNewLesForm({ ...newLesForm, content: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
              <Button size="sm" type="submit">Add Lesson</Button>
            </form>
          </div>
        </div>
      </Modal>

      {/* Add Roadmap Step Modal */}
      <Modal
        open={Boolean(stepModalRoadmap)}
        onClose={() => setStepModalRoadmap(null)}
        title={`Add Milestone · ${stepModalRoadmap?.title || ''}`}
      >
        <form onSubmit={addRoadmapStep} className="space-y-3">
          <input type="text" required placeholder="Skill Category" value={stepForm.skillCategory} onChange={(e) => setStepForm({ ...stepForm, skillCategory: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input type="text" required placeholder="Milestone Title" value={stepForm.title} onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <textarea rows={2} required placeholder="Step Description" value={stepForm.description} onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <select value={stepForm.recommendedCourseId} onChange={(e) => setStepForm({ ...stepForm, recommendedCourseId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
            <option value="">Optional Linked Course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <input type="text" placeholder="Practical Task" value={stepForm.projectTask} onChange={(e) => setStepForm({ ...stepForm, projectTask: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <Button type="submit" className="w-full">Add Milestone Step</Button>
        </form>
      </Modal>

      <Modal open={instructorModal} onClose={() => setInstructorModal(false)} title="Add Instructor">
        <form onSubmit={createInstructor} className="space-y-4">
          <input type="text" required placeholder="Full Name" value={instForm.fullName} onChange={(e) => setInstForm({ ...instForm, fullName: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input type="email" required placeholder="Email" value={instForm.email} onChange={(e) => setInstForm({ ...instForm, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input type="text" required placeholder="Headline (e.g. Staff Cloud Architect)" value={instForm.headline} onChange={(e) => setInstForm({ ...instForm, headline: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input type="text" placeholder="Company Background" value={instForm.companyBackground} onChange={(e) => setInstForm({ ...instForm, companyBackground: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <Button type="submit" className="w-full">Create Instructor Account</Button>
        </form>
      </Modal>

      <Modal open={Boolean(noteEnquiry)} onClose={() => setNoteEnquiry(null)} title="Add Internal Counsellor Note">
        <form onSubmit={addEnquiryNote} className="space-y-4">
          <textarea
            rows={3}
            required
            placeholder="Record call summary or next follow-up..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <Button type="submit">Save Note</Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
