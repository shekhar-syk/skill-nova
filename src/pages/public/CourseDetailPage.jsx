import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  PlayCircle,
  Terminal,
  Video,
} from 'lucide-react';
import { Button, Card, CourseThumbnail, Loader } from '../../components/DesignSystem.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';

export default function CourseDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrollingFree, setEnrollingFree] = useState(false);
  const [openModule, setOpenModule] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/courses/${slug}`)
      .then((res) => {
        if (active) setCourse(res.data.course);
      })
      .catch(() => {
        if (active) setCourse(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) return <Loader label="Loading course syllabus..." />;

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Course Not Found</h1>
        <p className="mt-2 text-slate-600">The requested course is unavailable or has been archived.</p>
        <Button className="mt-6" onClick={() => navigate('/courses')}>
          Back to Catalogue
        </Button>
      </div>
    );
  }

  const isFree = Number(course.courseFee || 0) === 0;

  const handleFreeEnroll = async () => {
    if (!isAuthenticated) {
      showToast('Please sign in to unlock this free course in your Student LMS.', 'info');
      navigate('/login', { state: { from: `/courses/${course.slug}` } });
      return;
    }
    setEnrollingFree(true);
    try {
      const res = await api.post('/enrollments/free', { courseId: course.id });
      showToast(
        res.data?.alreadyEnrolled
          ? 'You are already enrolled. Opening course workspace...'
          : 'Enrolled successfully! Opening your course workspace...',
        'success'
      );
      navigate(`/student/course/${course.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to enroll right now.', 'error');
    } finally {
      setEnrollingFree(false);
    }
  };

  const lessonIcon = (type) => {
    if (type === 'LAB') return <Terminal className="w-4 h-4 text-violet-600 shrink-0" />;
    if (type === 'LIVE') return <Video className="w-4 h-4 text-emerald-600 shrink-0" />;
    if (type === 'READING') return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
    return <PlayCircle className="w-4 h-4 text-violet-600 shrink-0" />;
  };

  return (
    <div>
      {/* Dark Navy Course Header */}
      <section className="bg-[#0A0F24] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="text-xs text-slate-400 mb-4 flex flex-wrap items-center gap-2">
            <Link to="/courses" className="hover:text-white">Courses</Link>
            <span>/</span>
            <Link to={`/courses?category=${course.categorySlug}`} className="hover:text-white">
              {course.categoryName}
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-8">
              <p className="font-mono text-xs text-violet-300 mb-3">
                {course.skillLevel} · {course.duration} · {course.enrolledCount} learners enrolled
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
                {course.title}
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl">
                {course.shortSummary}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
                <span>Instructor: <strong className="text-white">{course.instructorName}</strong></span>
                <span>·</span>
                <span>{course.liveSessionInfo || 'Weekend Live Sessions + Lab Support'}</span>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <p className="text-xs font-semibold text-slate-400 mb-2">TECHNOLOGIES COVERED</p>
                <p className="font-mono text-sm text-violet-200">{course.technologies.join('  ·  ')}</p>
              </div>
            </div>

            {/* Sticky Enrolment Card */}
            <div className="lg:col-span-4">
              <Card className="overflow-hidden text-slate-900 shadow-xl">
                <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-full h-44" />
                <div className="p-6">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-slate-500">Total Program Fee</span>
                    {isFree ? (
                      <span className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                        Free · ₹0
                      </span>
                    ) : (
                      <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {formatINR(course.courseFee)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between text-sm">
                    <span className="text-slate-500">
                      {isFree ? 'Access Tier' : 'Advance Seat Reservation'}
                    </span>
                    <span className="font-mono font-semibold text-violet-700 tabular-nums">
                      {isFree ? 'Full self-paced access' : formatINR(course.advanceAmount)}
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    {isFree ? (
                      <Button
                        className="w-full"
                        size="lg"
                        loading={enrollingFree}
                        onClick={handleFreeEnroll}
                      >
                        {isAuthenticated ? 'Enroll Free Now' : 'Sign In to Enroll Free'}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => navigate(`/admission?courseId=${course.id}`)}
                      >
                        Enroll Now
                      </Button>
                    )}
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() =>
                        navigate(`/contact?course=${encodeURIComponent(course.title)}&courseId=${course.id}`)
                      }
                    >
                      Request Syllabus / Enquire
                    </Button>
                  </div>

                  <ul className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <li>• 80% hands-on coding & engineering labs</li>
                    <li>• Verified completion certificate & portfolio</li>
                    <li>• {course.internshipAvailable ? 'Includes structured internship project' : 'Capstone evaluation included'}</li>
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Body Details */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          {/* Course Overview */}
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Program Overview</h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">{course.description}</p>
          </div>

          {/* Learning Outcomes */}
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Learning Outcomes</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {course.learningOutcomes.map((out, i) => (
                <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">{out}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Module-wise Curriculum */}
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Complete Curriculum</h2>
            <p className="mt-1 text-sm text-slate-500">
              {course.modules?.length || 0} structured modules with video lessons, reading guides, and labs.
            </p>
            <div className="mt-4 space-y-3">
              {(course.modules || []).map((mod, idx) => {
                const isOpen = openModule === idx;
                return (
                  <div key={mod.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenModule(isOpen ? -1 : idx)}
                      className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 cursor-pointer"
                    >
                      <div>
                        <h3 className="font-display text-base font-bold text-slate-900">{mod.title}</h3>
                        {mod.description && <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-xs text-slate-500">{mod.lessons.length} units</span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 divide-y divide-slate-100">
                        {mod.lessons.map((les) => (
                          <div key={les.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              {lessonIcon(les.lessonType)}
                              <span className="text-slate-800 truncate">{les.title}</span>
                              {les.isFreePreview && (
                                <span className="font-mono text-[11px] text-violet-700 font-medium">Preview</span>
                              )}
                            </div>
                            <span className="font-mono text-xs text-slate-500 flex items-center gap-1 shrink-0 tabular-nums">
                              <Clock className="w-3.5 h-3.5" /> {les.durationMinutes}m
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Internship Details */}
          {course.internshipAvailable && (
            <Card className="p-6 bg-slate-900 text-white border-slate-800">
              <p className="font-mono text-xs text-violet-300">TRAINING & INTERNSHIP TRACK</p>
              <h3 className="font-display text-xl font-bold mt-2">Integrated Industry Internship Opportunity</h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                {course.internshipDetails ||
                  'Complete weekly sprint milestones and submit your capstone project to receive guided internship evaluation and a verified project completion letter.'}
              </p>
            </Card>
          )}

          {/* Course FAQs */}
          {(course.faqs || []).length > 0 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Program FAQs</h2>
              <div className="mt-4 space-y-3">
                {course.faqs.map((f, idx) => (
                  <Card key={idx} className="p-5">
                    <h4 className="font-display text-sm font-bold text-slate-900">{f.q}</h4>
                    <p className="mt-1.5 text-sm text-slate-600">{f.a}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instructor Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6">
            <p className="font-mono text-xs text-violet-700 mb-3">LEAD INSTRUCTOR</p>
            <h3 className="font-display text-lg font-bold text-slate-900">{course.instructorName}</h3>
            <p className="text-sm font-medium text-slate-700 mt-1">{course.instructorHeadline}</p>
            <p className="text-xs text-slate-500 mt-1">
              {course.instructorCompany} · {course.instructorYears}+ years experience
            </p>
            {course.instructorBio && (
              <p className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 leading-relaxed">
                {course.instructorBio}
              </p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
