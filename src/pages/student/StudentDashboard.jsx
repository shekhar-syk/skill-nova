import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Box,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  Compass,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Flame,
  Flag,
  Gamepad2,
  LayoutDashboard,
  MessageCircle,
  Play,
  Plus,
  Send,
  ThumbsUp,
  Trophy,
  Upload,
  User,
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
import { Button, Card, CourseThumbnail, Loader, Modal, StatusText } from '../../components/DesignSystem.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import { api } from '../../services/api.js';
import { downloadCertificatePdf, formatDate, formatINR } from '../../utils/formatters.js';

export default function StudentDashboard() {
  const { user, profile, refreshMe } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [admissionsData, setAdmissionsData] = useState({ admissions: [], payments: [] });

  // Upgrade states
  const [gamification, setGamification] = useState(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('weekly');
  const [leaderboard, setLeaderboard] = useState([]);
  const [goalMinutes, setGoalMinutes] = useState(180);

  const [analytics, setAnalytics] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [joinedMeeting, setJoinedMeeting] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [myAppsData, setMyAppsData] = useState({ applications: [], recommendations: [] });
  const [applyJobModal, setApplyJobModal] = useState(null);
  const [applyForm, setApplyForm] = useState({ resumeUrl: '', portfolioUrl: '', coverNote: '', file: null });
  const [applyingJob, setApplyingJob] = useState(false);

  const [discussions, setDiscussions] = useState([]);
  const [communityCourseFilter, setCommunityCourseFilter] = useState('');
  const [communitySearch, setCommunitySearch] = useState('');
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newPostForm, setNewPostForm] = useState({ courseId: '', title: '', content: '', tags: '' });
  const [activeThread, setActiveThread] = useState(null);
  const [replyText, setReplyText] = useState('');

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    whatsappNumber: profile?.whatsapp_number || '',
    collegeName: profile?.college_name || '',
    department: profile?.department || '',
    yearOfStudy: profile?.year_of_study || '',
    state: profile?.state || '',
    educationLevel: profile?.education_level || '',
    bio: profile?.bio || '',
  });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, admRes, gamRes, lbRes, anRes, lsRes, attRes, jobRes, appRes, discRes] = await Promise.all([
        api.get('/student/dashboard'),
        api.get('/admissions/my'),
        api.get('/gamification/me'),
        api.get(`/gamification/leaderboard?period=${leaderboardPeriod}`),
        api.get('/student/analytics'),
        api.get('/live-sessions'),
        api.get('/live-sessions/my-attendance'),
        api.get('/placements/jobs'),
        api.get('/placements/my-applications'),
        api.get('/community/discussions'),
      ]);
      setDashboard(dashRes.data);
      setAdmissionsData(admRes.data);
      setGamification(gamRes.data);
      setGoalMinutes(gamRes.data?.streak?.weeklyGoalMinutes || 180);
      setLeaderboard(lbRes.data.leaderboard || []);
      setAnalytics(anRes.data);
      setLiveSessions(lsRes.data.sessions || []);
      setAttendanceHistory(attRes.data.attendance || []);
      setJobs(jobRes.data.opportunities || []);
      setMyAppsData(appRes.data);
      setDiscussions(discRes.data.discussions || []);
      if (dashRes.data.enrollments?.[0] && !newPostForm.courseId) {
        setNewPostForm((p) => ({ ...p, courseId: String(dashRes.data.enrollments[0].course_id) }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    api
      .get(`/gamification/leaderboard?period=${leaderboardPeriod}`)
      .then((res) => setLeaderboard(res.data.leaderboard || []))
      .catch(() => {});
  }, [leaderboardPeriod]);

  useEffect(() => {
    setProfileForm({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      whatsappNumber: profile?.whatsapp_number || '',
      collegeName: profile?.college_name || '',
      department: profile?.department || '',
      yearOfStudy: profile?.year_of_study || '',
      state: profile?.state || '',
      educationLevel: profile?.education_level || '',
      bio: profile?.bio || '',
    });
  }, [user, profile]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'skillnova/avatars');
    try {
      const res = await api.post('/uploads', fd);
      await api.put('/users/profile', { avatarUrl: res.data.file.url });
      await refreshMe();
      showToast('Profile picture updated.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Avatar upload failed.', 'error');
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put('/users/profile', profileForm);
      await refreshMe();
      showToast('Profile updated in PostgreSQL.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/change-password', passForm);
      setPassForm({ currentPassword: '', newPassword: '' });
      showToast('Password updated successfully.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to change password.', 'error');
    }
  };

  const payRemainingBalance = async (admissionId) => {
    try {
      const orderRes = await api.post('/payments/create-order', { admissionId, paymentType: 'BALANCE' });
      const order = orderRes.data.order;
      await api.post('/payments/verify', { razorpay_order_id: order.orderId, simulateSandbox: true });
      showToast('Remaining balance cleared!', 'success');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Payment failed.', 'error');
    }
  };

  const saveGoal = async (e) => {
    e.preventDefault();
    try {
      await api.put('/gamification/goal', { weeklyGoalMinutes: Number(goalMinutes) });
      showToast('Weekly learning goal updated.', 'success');
      const gamRes = await api.get('/gamification/me');
      setGamification(gamRes.data);
    } catch {
      showToast('Failed to update learning goal.', 'error');
    }
  };

  const joinLiveSession = async (session) => {
    try {
      const res = await api.post(`/live-sessions/${session.id}/attend`);
      setJoinedMeeting({
        title: session.title,
        status: res.data.attendanceStatus,
        url: res.data.meetingUrl,
      });
      showToast(`Attendance recorded (${res.data.attendanceStatus}). Room link is ready below.`, 'success');
      const [lsRes, attRes] = await Promise.all([
        api.get('/live-sessions'),
        api.get('/live-sessions/my-attendance'),
      ]);
      setLiveSessions(lsRes.data.sessions || []);
      setAttendanceHistory(attRes.data.attendance || []);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to join live session.', 'error');
    }
  };

  const submitJobApplication = async (e) => {
    e.preventDefault();
    if (!applyJobModal) return;
    setApplyingJob(true);
    try {
      const fd = new FormData();
      if (applyForm.file) fd.append('resume', applyForm.file);
      if (applyForm.resumeUrl) fd.append('resumeUrl', applyForm.resumeUrl);
      if (applyForm.portfolioUrl) fd.append('portfolioUrl', applyForm.portfolioUrl);
      if (applyForm.coverNote) fd.append('coverNote', applyForm.coverNote);
      await api.post(`/placements/jobs/${applyJobModal.id}/apply`, fd);
      showToast('Placement application submitted!', 'success');
      setApplyJobModal(null);
      setApplyForm({ resumeUrl: '', portfolioUrl: '', coverNote: '', file: null });
      const [jobRes, appRes] = await Promise.all([
        api.get('/placements/jobs'),
        api.get('/placements/my-applications'),
      ]);
      setJobs(jobRes.data.opportunities || []);
      setMyAppsData(appRes.data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Application submission failed.', 'error');
    } finally {
      setApplyingJob(false);
    }
  };

  const refreshCommunity = async (courseId = communityCourseFilter, search = communitySearch) => {
    const params = new URLSearchParams();
    if (courseId) params.set('courseId', courseId);
    if (search.trim()) params.set('search', search.trim());
    const res = await api.get(`/community/discussions?${params.toString()}`);
    setDiscussions(res.data.discussions || []);
  };

  const openThread = async (id) => {
    try {
      const res = await api.get(`/community/discussions/${id}`);
      setActiveThread(res.data);
    } catch {
      showToast('Unable to load discussion thread.', 'error');
    }
  };

  const createDiscussion = async (e) => {
    e.preventDefault();
    try {
      await api.post('/community/discussions', newPostForm);
      showToast('Discussion question posted!', 'success');
      setNewPostOpen(false);
      setNewPostForm((p) => ({ ...p, title: '', content: '', tags: '' }));
      refreshCommunity();
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to post question.', 'error');
    }
  };

  const postReply = async (e) => {
    e.preventDefault();
    if (!activeThread || !replyText.trim()) return;
    try {
      await api.post(`/community/discussions/${activeThread.discussion.id}/replies`, { content: replyText });
      setReplyText('');
      openThread(activeThread.discussion.id);
      refreshCommunity();
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to post reply.', 'error');
    }
  };

  const toggleLike = async (targetType, targetId) => {
    try {
      await api.post('/community/likes', { targetType, targetId });
      refreshCommunity();
      if (activeThread) openThread(activeThread.discussion.id);
    } catch {
      showToast('Failed to update upvote.', 'error');
    }
  };

  const acceptReply = async (replyId) => {
    try {
      await api.patch(`/community/replies/${replyId}/accept`);
      showToast('Marked as accepted answer (+15 XP to responder)!', 'success');
      if (activeThread) openThread(activeThread.discussion.id);
    } catch (err) {
      showToast(err.response?.data?.message || 'Only thread author or mentor can accept.', 'error');
    }
  };

  const reportContent = async (targetType, targetId) => {
    try {
      await api.post('/community/report', { targetType, targetId, reason: 'Flagged by community member' });
      showToast('Reported to instructors & moderators.', 'info');
    } catch {
      showToast('Failed to report.', 'error');
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'learning', label: 'My Learning', icon: BookOpen },
    { id: 'analytics', label: 'Learning Analytics', icon: BarChart3 },
    { id: 'gamification', label: 'XP & Leaderboard', icon: Trophy },
    { id: 'live-classes', label: 'Live Classes', icon: Video },
    { id: 'assessments', label: 'Assessments', icon: CheckSquare },
    { id: 'assignments', label: 'Assignments', icon: FileText },
    { id: 'placements', label: 'Placements & Jobs', icon: Briefcase },
    { id: 'community', label: 'Community Forum', icon: MessageCircle },
    { id: 'certificates', label: 'Certificates', icon: Award },
    { id: 'payments', label: 'Admissions & Fees', icon: CreditCard },
    { id: 'profile', label: 'Profile & Security', icon: User },
  ];

  const summary = dashboard?.summary || {};
  const enrollments = dashboard?.enrollments || [];
  const assignments = dashboard?.assignments || [];
  const certificates = dashboard?.certificates || [];
  const quizAttempts = dashboard?.quizAttempts || [];

  const levelFloor = gamification?.currentFloor || 0;
  const levelCeiling = gamification?.nextCeiling || 250;
  const xpProgressPct = Math.min(
    100,
    Math.round((((gamification?.totalXp || 0) - levelFloor) / Math.max(1, levelCeiling - levelFloor)) * 100)
  );

  const filteredJobs = jobs.filter((j) => !jobTypeFilter || j.opportunity_type === jobTypeFilter);

  return (
    <DashboardLayout
      title="Student Learning Portal"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {loading ? (
        <Loader label="Loading your learning workspace..." />
      ) : (
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              <Card className="p-6 bg-[#0A0F24] text-white border-slate-800">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <p className="font-mono text-xs text-violet-300">WELCOME BACK</p>
                    <h2 className="font-display text-2xl font-bold mt-1">{user?.fullName}</h2>
                    <p className="text-sm text-slate-300 mt-1">
                      Level {gamification?.level || 1} · {gamification?.totalXp || 0} XP · Rank #{gamification?.rank || 1} · {gamification?.streak?.currentStreak || 0}-Day Streak
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/student/ai-assistant"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
                    >
                      <Bot className="w-4 h-4" /> Ask AI Tutor
                    </Link>
                    <Link
                      to="/labs"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg"
                    >
                      <Box className="w-4 h-4 text-sky-400" /> SkillNova Labs
                    </Link>
                    <Link
                      to="/game"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg"
                    >
                      <Gamepad2 className="w-4 h-4 text-emerald-400" /> Circuit Runner 3D
                    </Link>
                    <Link
                      to="/roadmaps"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white text-[#0A0F24] hover:bg-slate-100 rounded-lg"
                    >
                      <Compass className="w-4 h-4" /> Career Roadmaps
                    </Link>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Enrolled Courses', summary.enrolledCount || 0],
                  ['Avg Completion', `${summary.avgCompletion || 0}%`],
                  ['Total XP Points', gamification?.totalXp || 0],
                  ['Daily Streak', `${gamification?.streak?.currentStreak || 0}d`],
                ].map(([label, val]) => (
                  <Card key={label} className="p-5">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-mono text-2xl font-bold text-slate-900 mt-2 tabular-nums">{val}</p>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-7 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-base font-bold text-slate-900">Continue Learning</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('learning')}
                      className="text-xs font-semibold text-violet-700 hover:underline cursor-pointer"
                    >
                      All courses →
                    </button>
                  </div>
                  {enrollments.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500">No active enrollments yet.</p>
                      <Button className="mt-4" size="sm" onClick={() => navigate('/courses')}>
                        Explore 45+ Courses
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {enrollments.map((enr) => (
                        <div
                          key={enr.id}
                          className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500">{enr.category_name}</p>
                            <h4 className="font-display text-sm font-bold text-slate-900 truncate">{enr.title}</h4>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-violet-600 rounded-full"
                                  style={{ width: `${enr.progress_percent}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                                {enr.progress_percent}%
                              </span>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => navigate(`/student/course/${enr.course_id}`)}>
                            <Play className="w-3.5 h-3.5" /> Resume
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="lg:col-span-5 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Upcoming Live Classes & Activity
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('live-classes')}
                      className="text-xs font-semibold text-violet-700 hover:underline cursor-pointer"
                    >
                      Schedule →
                    </button>
                  </div>
                  <div className="space-y-3 text-sm">
                    {liveSessions.slice(0, 3).map((ls) => (
                      <div key={ls.id} className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-xs truncate">{ls.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {ls.course_title} · {formatDate(ls.scheduled_at)}
                          </p>
                        </div>
                        <StatusText status={ls.my_attendance_status || ls.status} />
                      </div>
                    ))}
                    {(dashboard?.recentActivities || []).slice(0, 4).map((n) => (
                      <div key={n.id} className="pb-2 border-b border-slate-100 last:border-0">
                        <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                        <p className="text-xs text-slate-500">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}

          {activeTab === 'learning' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.length === 0 ? (
                <Card className="col-span-full p-10 text-center">
                  <p className="text-slate-600">You are not enrolled in any courses yet.</p>
                  <Button className="mt-4" onClick={() => navigate('/admission')}>Apply for a Course</Button>
                </Card>
              ) : (
                enrollments.map((enr) => (
                  <Card key={enr.id} className="overflow-hidden flex flex-col">
                    <CourseThumbnail src={enr.thumbnail_url} alt={enr.title} className="w-full h-40" />
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-slate-500">{enr.category_name} · {enr.duration}</p>
                        <h3 className="font-display text-base font-bold text-slate-900 mt-1">{enr.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">Mentor: {enr.instructor_name}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-500">Progress</span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">{enr.progress_percent}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                          <div className="h-full bg-violet-600" style={{ width: `${enr.progress_percent}%` }} />
                        </div>
                        <Button className="w-full" size="sm" onClick={() => navigate(`/student/course/${enr.course_id}`)}>
                          Open Course Workspace
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'analytics' && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Weekly Goal Done', `${analytics.streak?.weekly_minutes_done || 0} / ${analytics.streak?.weekly_goal_minutes || 180}m`],
                  ['Longest Streak', `${analytics.streak?.longest_streak || 0} days`],
                  ['Assignments Reviewed', analytics.assignmentSummary?.reviewed || 0],
                  ['Active Roadmaps', analytics.roadmaps?.length || 0],
                ].map(([label, val]) => (
                  <Card key={label} className="p-5">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-mono text-2xl font-bold text-slate-900 mt-2 tabular-nums">{val}</p>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-4">
                    7-Day Learning XP & Study Minutes
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.weeklyActivity || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="xp" name="XP Earned" stroke="#6d28d9" fill="#ddd6fe" strokeWidth={2} />
                        <Area type="monotone" dataKey="minutes" name="Study Mins" stroke="#0A0F24" fill="#cbd5e1" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-4">
                    Course Completion % & Quiz Performance
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.courseProgress || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="course" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="progress" name="Completion %" fill="#6d28d9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-4">Quiz Score Trend</h3>
                  {(analytics.quizTrend || []).length === 0 ? (
                    <p className="text-sm text-slate-500">Complete a course quiz to view your score trajectory.</p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.quizTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="quiz" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="percentage" name="Score %" fill="#0A0F24" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-4">Skill Accuracy Matrix</h3>
                  {(analytics.skillMastery || []).length === 0 ? (
                    <p className="text-sm text-slate-500">Attempt tagged quizzes to generate your skill mastery bars.</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.skillMastery.map((s) => (
                        <div key={s.skill} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-slate-800">{s.skill}</span>
                            <span className="font-mono text-slate-600 tabular-nums">
                              {s.accuracy}% ({s.questionsAnswered} Qs)
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-600" style={{ width: `${s.accuracy}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'gamification' && gamification && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6 bg-[#0A0F24] text-white border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-violet-300">STUDENT RANK #{gamification.rank}</p>
                      <h3 className="font-display text-2xl font-bold mt-1">
                        Level {gamification.level} · {gamification.totalXp} XP
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl">
                      <Flame className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="font-mono text-sm font-bold">{gamification.streak.currentStreak} Day Streak</p>
                        <p className="font-mono text-[10px] text-slate-400">Best: {gamification.streak.longestStreak} days</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                      <span>Progress to Level {gamification.level + 1}</span>
                      <span className="font-mono tabular-nums">
                        {gamification.totalXp} / {gamification.nextCeiling} XP
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${xpProgressPct}%` }} />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-display text-base font-bold text-slate-900 mb-2">Weekly Learning Goal</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Completed {gamification.streak.weeklyMinutesDone} / {gamification.streak.weeklyGoalMinutes} minutes this week
                  </p>
                  <form onSubmit={saveGoal} className="space-y-3">
                    <input
                      type="number"
                      min={30}
                      max={1800}
                      step={30}
                      value={goalMinutes}
                      onChange={(e) => setGoalMinutes(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                    <Button type="submit" size="sm" className="w-full">
                      Update Weekly Target (mins)
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Achievement Badges */}
              <Card className="p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Achievement Badges</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(gamification.achievements || []).map((b) => (
                    <div
                      key={b.id}
                      className={`p-4 rounded-xl border ${
                        b.unlocked ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200 bg-slate-50 opacity-65'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Award className={`w-5 h-5 ${b.unlocked ? 'text-violet-600' : 'text-slate-400'}`} />
                        <span className="font-mono text-[11px] font-semibold text-slate-600">+{b.xpReward} XP</span>
                      </div>
                      <h4 className="font-display text-sm font-bold text-slate-900">{b.title}</h4>
                      <p className="text-xs text-slate-600 mt-1">{b.description}</p>
                      <p className="font-mono text-[10px] mt-2 text-violet-700">
                        {b.unlocked ? `UNLOCKED ${formatDate(b.unlockedAt)}` : 'LOCKED'}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Leaderboard + Recent XP */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-7 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg font-bold text-slate-900">Student Leaderboard</h3>
                    <div className="flex gap-1.5">
                      {['weekly', 'monthly'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setLeaderboardPeriod(p)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                            leaderboardPeriod === p
                              ? 'bg-[#0A0F24] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-3">#</th>
                          <th className="py-2 pr-4">Learner</th>
                          <th className="py-2 pr-4 text-right">Streak</th>
                          <th className="py-2 pr-4 text-right">Badges</th>
                          <th className="py-2 text-right">XP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leaderboard.map((row) => (
                          <tr key={row.userId} className={row.isMe ? 'bg-violet-50/70 font-semibold' : ''}>
                            <td className="py-2.5 pr-3 font-mono text-xs">{row.rank}</td>
                            <td className="py-2.5 pr-4">
                              {row.fullName} {row.isMe && <span className="font-mono text-[10px] text-violet-700">(YOU)</span>}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono text-xs">{row.currentStreak}d</td>
                            <td className="py-2.5 pr-4 text-right font-mono text-xs">{row.badgesCount}</td>
                            <td className="py-2.5 text-right font-mono font-bold text-violet-700 tabular-nums">{row.xp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="lg:col-span-5 p-6">
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-4">XP Activity Ledger</h3>
                  <div className="space-y-3">
                    {(gamification.recentPoints || []).map((pt) => (
                      <div key={pt.id} className="pb-2.5 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">{pt.description}</p>
                          <p className="font-mono text-[10px] text-slate-500">{pt.event_type} · {formatDate(pt.created_at)}</p>
                        </div>
                        <span className="font-mono text-xs font-bold text-emerald-700 shrink-0">+{pt.points} XP</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'live-classes' && (
            <div className="space-y-6">
              {joinedMeeting && (
                <Card className="p-5 bg-emerald-50 border-emerald-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-semibold text-emerald-800">
                      ATTENDANCE RECORDED: {joinedMeeting.status}
                    </p>
                    <p className="font-display text-base font-bold text-slate-900 mt-0.5">{joinedMeeting.title}</p>
                  </div>
                  <a
                    href={joinedMeeting.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg"
                  >
                    Launch Meeting Room <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Live Interactive Classes</h3>
                {liveSessions.length === 0 ? (
                  <p className="text-sm text-slate-500">No live classes scheduled for your enrolled courses yet.</p>
                ) : (
                  <div className="space-y-4">
                    {liveSessions.map((ls) => (
                      <div key={ls.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="font-mono text-xs text-violet-700">
                            {ls.course_title} · {ls.meeting_platform} · {ls.duration_minutes}m
                          </p>
                          <h4 className="font-display text-base font-bold text-slate-900 mt-1">{ls.title}</h4>
                          <p className="text-sm text-slate-600 mt-1">{ls.description}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Mentor: {ls.instructor_name} · Scheduled: {new Date(ls.scheduled_at).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <StatusText status={ls.my_attendance_status || ls.status} />
                          {ls.status !== 'CANCELLED' && (
                            <Button size="sm" onClick={() => joinLiveSession(ls)}>
                              <Video className="w-3.5 h-3.5" /> Join & Mark Attendance
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="font-display text-base font-bold text-slate-900 mb-4">My Attendance History</h3>
                {attendanceHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">Join a live class above to record your attendance.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">Session</th>
                          <th className="py-2 pr-4">Course</th>
                          <th className="py-2 pr-4">Platform</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendanceHistory.map((att) => (
                          <tr key={att.id}>
                            <td className="py-2.5 pr-4 font-medium">{att.session_title}</td>
                            <td className="py-2.5 pr-4 text-slate-600">{att.course_title}</td>
                            <td className="py-2.5 pr-4 text-xs">{att.meeting_platform}</td>
                            <td className="py-2.5 pr-4"><StatusText status={att.status} /></td>
                            <td className="py-2.5 font-mono text-xs text-slate-500">{formatDate(att.joined_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'assessments' && (
            <Card className="p-6">
              <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Quiz History & Scores</h3>
              {quizAttempts.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Open any enrolled course workspace to attempt its module readiness quizzes.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="py-2.5 pr-4">Quiz</th>
                        <th className="py-2.5 pr-4">Course</th>
                        <th className="py-2.5 pr-4 text-right">Score</th>
                        <th className="py-2.5 pr-4">Result</th>
                        <th className="py-2.5">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quizAttempts.map((q) => (
                        <tr key={q.id}>
                          <td className="py-3 pr-4 font-medium text-slate-900">{q.quiz_title}</td>
                          <td className="py-3 pr-4 text-slate-600">{q.course_title}</td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">
                            {q.score}/{q.total_questions} ({q.percentage}%)
                          </td>
                          <td className="py-3 pr-4">
                            <StatusText status={q.passed ? 'COMPLETED' : 'FAILED'} />
                          </td>
                          <td className="py-3 font-mono text-xs text-slate-500">{formatDate(q.attempted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'assignments' && (
            <div className="space-y-4">
              {assignments.length === 0 ? (
                <Card className="p-8 text-center text-sm text-slate-500">No assignments yet.</Card>
              ) : (
                assignments.map((a) => (
                  <Card key={a.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500">{a.course_title} · Due {a.due_date}</p>
                      <h4 className="font-display text-base font-bold text-slate-900 mt-1">{a.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{a.description}</p>
                      {a.instructor_feedback && (
                        <p className="mt-2 text-xs text-emerald-700 font-medium">
                          Mentor Feedback ({a.score}/100): {a.instructor_feedback}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <StatusText status={a.submission_status || 'PENDING'} />
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/student/course/${a.course_id}`)}>
                        {a.submission_id ? 'Update Submission' : 'Submit Work'}
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'placements' && (
            <div className="space-y-6">
              {myAppsData.recommendations?.length > 0 && (
                <Card className="p-5 bg-violet-50 border-violet-200 space-y-2">
                  <p className="font-display text-sm font-bold text-violet-900">Mentor Endorsements & Recommendations</p>
                  {myAppsData.recommendations.map((rec) => (
                    <p key={rec.id} className="text-xs text-slate-700">
                      <strong>{rec.instructor_name}</strong> ({rec.course_title || 'SKILLNOVA Faculty'}): “{rec.endorsement_note}”
                    </p>
                  ))}
                </Card>
              )}

              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">Placement & Internship Portal</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Apply directly to hiring partners and upload your resume.</p>
                  </div>
                  <select
                    value={jobTypeFilter}
                    onChange={(e) => setJobTypeFilter(e.target.value)}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">All Roles ({jobs.length})</option>
                    <option value="JOB">Full-Time Jobs</option>
                    <option value="INTERNSHIP">Internships</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredJobs.map((j) => (
                    <div key={j.id} className="p-5 rounded-xl border border-slate-200 flex flex-col justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs text-violet-700">
                          {j.opportunity_type} · {j.work_mode} · {j.stipend_or_ctc}
                        </p>
                        <h4 className="font-display text-base font-bold text-slate-900 mt-1">{j.title}</h4>
                        <p className="text-xs text-slate-600 font-medium">{j.company_name} · {j.location}</p>
                        <p className="text-xs text-slate-600 mt-2">{j.description}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          Skills: {(j.required_skills || []).join(', ')} · Deadline: {j.application_deadline}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        {j.myApplicationStatus ? (
                          <StatusText status={j.myApplicationStatus} />
                        ) : (
                          <span className="font-mono text-xs text-emerald-700">OPEN FOR APPLICATIONS</span>
                        )}
                        {!j.myApplicationStatus && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setApplyJobModal(j);
                              setApplyForm({ resumeUrl: '', portfolioUrl: '', coverNote: '', file: null });
                            }}
                          >
                            Apply Now
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-display text-base font-bold text-slate-900 mb-4">My Applications Tracker</h3>
                {(myAppsData.applications || []).length === 0 ? (
                  <p className="text-sm text-slate-500">You have not submitted any job or internship applications yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">Role</th>
                          <th className="py-2 pr-4">Company</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2">Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myAppsData.applications.map((a) => (
                          <tr key={a.id}>
                            <td className="py-2.5 pr-4 font-medium">{a.job_title}</td>
                            <td className="py-2.5 pr-4 text-slate-600">{a.company_name}</td>
                            <td className="py-2.5 pr-4 font-mono text-xs">{a.opportunity_type}</td>
                            <td className="py-2.5 pr-4"><StatusText status={a.status} /></td>
                            <td className="py-2.5 font-mono text-xs text-slate-500">{formatDate(a.applied_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'community' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-slate-900">Course Discussions</h3>
                    <Button size="sm" onClick={() => setNewPostOpen(true)}>
                      <Plus className="w-3.5 h-3.5" /> Ask Question
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={communityCourseFilter}
                      onChange={(e) => {
                        setCommunityCourseFilter(e.target.value);
                        refreshCommunity(e.target.value, communitySearch);
                      }}
                      className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">All Courses</option>
                      {enrollments.map((enr) => (
                        <option key={enr.course_id} value={enr.course_id}>
                          {enr.title}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={communitySearch}
                      onChange={(e) => {
                        setCommunitySearch(e.target.value);
                        refreshCommunity(communityCourseFilter, e.target.value);
                      }}
                      placeholder="Search questions..."
                      className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </Card>

                <div className="space-y-2.5 max-h-[540px] overflow-y-auto">
                  {discussions.map((d) => (
                    <Card
                      key={d.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        activeThread?.discussion?.id === d.id ? 'border-violet-600 bg-violet-50/40' : 'hover:border-violet-300'
                      }`}
                    >
                      <div onClick={() => openThread(d.id)}>
                        <p className="font-mono text-[11px] text-violet-700">
                          {d.course_title} {d.is_pinned ? '· PINNED' : ''}
                        </p>
                        <h4 className="font-display text-sm font-bold text-slate-900 mt-1">{d.title}</h4>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{d.content}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>{d.author_name}</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleLike('DISCUSSION', d.id)}
                            className={`inline-flex items-center gap-1 cursor-pointer ${d.likedByMe ? 'text-violet-700 font-semibold' : ''}`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" /> {d.likes_count}
                          </button>
                          <span>{d.replies_count} replies</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7">
                {!activeThread ? (
                  <Card className="p-10 text-center text-sm text-slate-500">
                    Select any discussion thread on the left to read replies, upvote solutions, or respond.
                  </Card>
                ) : (
                  <Card className="p-6 space-y-5">
                    <div className="pb-4 border-b border-slate-200">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-xs text-violet-700">
                            {activeThread.discussion.course_title} · By {activeThread.discussion.author_name}
                          </p>
                          <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                            {activeThread.discussion.title}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => reportContent('DISCUSSION', activeThread.discussion.id)}
                          className="text-xs text-slate-400 hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" /> Report
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 mt-3 whitespace-pre-line">
                        {activeThread.discussion.content}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <p className="font-display text-sm font-bold text-slate-900">
                        Replies ({activeThread.replies.length})
                      </p>
                      {activeThread.replies.map((r) => (
                        <div
                          key={r.id}
                          className={`p-4 rounded-xl border ${
                            r.is_accepted ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-slate-900">
                              {r.author_name}{' '}
                              <span className="font-mono text-[10px] text-slate-500">({r.author_role})</span>
                            </span>
                            {r.is_accepted && (
                              <span className="font-mono text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> ACCEPTED ANSWER
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mt-2 whitespace-pre-line">{r.content}</p>
                          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                            <button
                              type="button"
                              onClick={() => toggleLike('REPLY', r.id)}
                              className={`inline-flex items-center gap-1 cursor-pointer ${r.likedByMe ? 'text-violet-700 font-semibold' : ''}`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" /> Helpful ({r.likes_count})
                            </button>
                            {!r.is_accepted && (activeThread.discussion.user_id === user?.id || ['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'].includes(user?.role)) && (
                              <button
                                type="button"
                                onClick={() => acceptReply(r.id)}
                                className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                              >
                                Accept Answer
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => reportContent('REPLY', r.id)}
                              className="hover:text-rose-600 cursor-pointer"
                            >
                              Report
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!activeThread.discussion.is_locked && (
                      <form onSubmit={postReply} className="pt-4 border-t border-slate-200 flex gap-3">
                        <input
                          type="text"
                          required
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a helpful technical response..."
                          className="flex-1 px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                        <Button type="submit" size="sm">
                          <Send className="w-3.5 h-3.5" /> Reply
                        </Button>
                      </form>
                    )}
                  </Card>
                )}
              </div>
            </div>
          )}

          {activeTab === 'certificates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certificates.length === 0 ? (
                <Card className="col-span-full p-8 text-center text-sm text-slate-500">
                  Complete 100% of lessons in any enrolled course to unlock your verifiable PDF certificate.
                </Card>
              ) : (
                certificates.map((cert) => (
                  <Card key={cert.id} className="p-6 flex flex-col justify-between">
                    <div>
                      <p className="font-mono text-xs text-violet-700">{cert.certificate_code}</p>
                      <h3 className="font-display text-lg font-bold text-slate-900 mt-1">{cert.course_title}</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Issued to {cert.student_name} · {cert.grade} · {formatDate(cert.issued_at)}
                      </p>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button size="sm" onClick={() => downloadCertificatePdf(cert)}>
                        <Download className="w-4 h-4" /> Download PDF
                      </Button>
                      <Link
                        to="/verify-certificate"
                        className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                      >
                        Verify Credential
                      </Link>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-display text-base font-bold text-slate-900 mb-4">My Admissions & Fee Balance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Registration ID</th>
                        <th className="py-2 pr-4">Course</th>
                        <th className="py-2 pr-4 text-right">Total</th>
                        <th className="py-2 pr-4 text-right">Paid</th>
                        <th className="py-2 pr-4 text-right">Balance</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {admissionsData.admissions.map((a) => (
                        <tr key={a.id}>
                          <td className="py-3 pr-4 font-mono text-xs">{a.registration_id}</td>
                          <td className="py-3 pr-4 font-medium">{a.course_title}</td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatINR(a.total_fee)}</td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums text-emerald-700">{formatINR(a.amount_paid)}</td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatINR(a.remaining_balance)}</td>
                          <td className="py-3 pr-4"><StatusText status={a.status} /></td>
                          <td className="py-3">
                            {a.remaining_balance > 0 && (
                              <Button size="sm" onClick={() => payRemainingBalance(a.id)}>
                                Pay Balance
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-display text-base font-bold text-slate-900 mb-4">Payment Receipts</h3>
                {(admissionsData.payments || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No fee receipts recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">Receipt #</th>
                          <th className="py-2 pr-4">Course</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4 text-right">Amount</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {admissionsData.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 pr-4 font-mono text-xs">{p.receipt_number}</td>
                            <td className="py-2.5 pr-4">{p.course_title}</td>
                            <td className="py-2.5 pr-4 font-mono text-xs">{p.payment_type}</td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{formatINR(p.amount)}</td>
                            <td className="py-2.5 pr-4"><StatusText status={p.status} /></td>
                            <td className="py-2.5 font-mono text-xs text-slate-500">{formatDate(p.paid_at || p.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-7 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Personal & Educational Profile</h3>
                <div className="mb-5 flex items-center gap-4">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="w-14 h-14 rounded-full object-cover border" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#0A0F24] text-white flex items-center justify-center font-bold">
                      {user?.fullName?.[0]}
                    </div>
                  )}
                  <label className="text-xs font-medium text-violet-700 cursor-pointer hover:underline">
                    Upload Profile Picture
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>

                <form onSubmit={saveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number</label>
                      <input
                        type="text"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">College / University</label>
                      <input
                        type="text"
                        value={profileForm.collegeName}
                        onChange={(e) => setProfileForm({ ...profileForm, collegeName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                      <input
                        type="text"
                        value={profileForm.department}
                        onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Year of Study</label>
                      <input
                        type="text"
                        value={profileForm.yearOfStudy}
                        onChange={(e) => setProfileForm({ ...profileForm, yearOfStudy: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                      <input
                        type="text"
                        value={profileForm.state}
                        onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <Button type="submit" loading={savingProfile}>Save Profile</Button>
                </form>
              </Card>

              <Card className="lg:col-span-5 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Change Password</h3>
                <form onSubmit={changePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={passForm.currentPassword}
                      onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={passForm.newPassword}
                      onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <Button type="submit" variant="navy">Update Password</Button>
                </form>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Apply for Job/Internship Modal */}
      <Modal
        open={Boolean(applyJobModal)}
        onClose={() => setApplyJobModal(null)}
        title={`Apply: ${applyJobModal?.title || ''} (${applyJobModal?.company_name || ''})`}
      >
        <form onSubmit={submitJobApplication} className="space-y-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer border border-slate-300 px-3 py-2.5 rounded-lg hover:bg-slate-50">
            <Upload className="w-4 h-4 text-violet-600" />
            <span>{applyForm.file ? applyForm.file.name : 'Upload Resume PDF / DOCX (or paste link below)'}</span>
            <input
              type="file"
              onChange={(e) => setApplyForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
              className="hidden"
            />
          </label>
          <input
            type="url"
            placeholder="Resume Link (Google Drive / LinkedIn / GitHub) — optional if file attached"
            value={applyForm.resumeUrl}
            onChange={(e) => setApplyForm((p) => ({ ...p, resumeUrl: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="url"
            placeholder="GitHub / Live Portfolio URL"
            value={applyForm.portfolioUrl}
            onChange={(e) => setApplyForm((p) => ({ ...p, portfolioUrl: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <textarea
            rows={3}
            placeholder="Why are you a strong fit for this role?"
            value={applyForm.coverNote}
            onChange={(e) => setApplyForm((p) => ({ ...p, coverNote: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <Button type="submit" loading={applyingJob} className="w-full">
            Submit Application
          </Button>
        </form>
      </Modal>

      {/* Post Community Discussion Modal */}
      <Modal open={newPostOpen} onClose={() => setNewPostOpen(false)} title="Ask Course Community">
        <form onSubmit={createDiscussion} className="space-y-4">
          <select
            required
            value={newPostForm.courseId}
            onChange={(e) => setNewPostForm((p) => ({ ...p, courseId: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">Select Enrolled Course</option>
            {enrollments.map((e) => (
              <option key={e.course_id} value={e.course_id}>{e.title}</option>
            ))}
          </select>
          <input
            type="text"
            required
            placeholder="Question Title"
            value={newPostForm.title}
            onChange={(e) => setNewPostForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <textarea
            rows={4}
            required
            placeholder="Describe your concept question or debugging context..."
            value={newPostForm.content}
            onChange={(e) => setNewPostForm((p) => ({ ...p, content: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            placeholder="Tags (comma separated, e.g. react, sql)"
            value={newPostForm.tags}
            onChange={(e) => setNewPostForm((p) => ({ ...p, tags: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <Button type="submit" className="w-full">Publish Question</Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
