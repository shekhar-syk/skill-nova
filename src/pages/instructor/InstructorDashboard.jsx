import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Database,
  FilePlus,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { Button, Card, Loader, Modal, StatusText } from '../../components/DesignSystem.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import { api } from '../../services/api.js';
import { formatDate } from '../../utils/formatters.js';

const EMPTY_QUESTION = () => ({
  questionText: '',
  questionType: 'MCQ',
  options: ['', '', '', ''],
  correctOptionIndex: 0,
  correctMultiIndices: [0],
  shortAnswerText: '',
  difficulty: 'Medium',
  skillTag: 'Core Engineering',
  marks: 1,
  explanation: '',
});

export default function InstructorDashboard() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('courses');
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState({ courses: [], students: [], submissions: [], quizzes: [], assignments: [] });

  const [liveModalCourse, setLiveModalCourse] = useState(null);
  const [liveText, setLiveText] = useState('');

  // Curriculum Forms (Module + Lesson)
  const [moduleForm, setModuleForm] = useState({ courseId: '', title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({
    courseId: '',
    moduleId: '',
    title: '',
    lessonType: 'VIDEO',
    durationMinutes: 40,
    content: '',
  });
  const [courseModules, setCourseModules] = useState([]);

  // Assignment & Quiz Forms
  const [assignForm, setAssignForm] = useState({
    courseId: '',
    title: '',
    description: '',
    dueDate: '2026-12-30',
    maxScore: 100,
  });

  const [quizMeta, setQuizMeta] = useState({
    courseId: '',
    title: '',
    description: '',
    passingScore: 60,
    timeLimitMinutes: 15,
    randomizeQuestions: true,
    allowNegativeMarking: false,
    negativeMarksPerWrong: 0.25,
  });
  const [quizQuestions, setQuizQuestions] = useState([EMPTY_QUESTION()]);

  // Question Bank
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankForm, setBankForm] = useState({
    courseId: '',
    questionText: '',
    questionType: 'MCQ',
    opt0: '',
    opt1: '',
    opt2: '',
    opt3: '',
    correctOptionIndex: 0,
    difficulty: 'Medium',
    skillTag: 'Backend Engineering',
    explanation: '',
  });
  const [importTargetQuizId, setImportTargetQuizId] = useState('');
  const [selectedBankIds, setSelectedBankIds] = useState([]);

  // Review Modal
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewScore, setReviewScore] = useState(90);
  const [reviewFeedback, setReviewFeedback] = useState('');

  // Live Sessions & Attendance
  const [liveSessions, setLiveSessions] = useState([]);
  const [sessionForm, setSessionForm] = useState({
    courseId: '',
    title: '',
    description: '',
    meetingUrl: 'https://meet.google.com/skillnova-live',
    meetingPlatform: 'Google Meet',
    scheduledAt: '2026-12-15T18:00',
    durationMinutes: 75,
  });
  const [rosterModal, setRosterModal] = useState(null);
  const [rosterList, setRosterList] = useState([]);

  // Placement Recommendation Modal
  const [recommendModal, setRecommendModal] = useState(null);
  const [jobsList, setJobsList] = useState([]);
  const [recommendForm, setRecommendForm] = useState({ opportunityId: '', endorsementNote: '' });

  // Community Q&A
  const [discussions, setDiscussions] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [replyText, setReplyText] = useState('');

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [wsRes, lsRes, qbRes, jobRes, discRes] = await Promise.all([
        api.get('/instructors/workspace'),
        api.get('/live-sessions'),
        api.get('/question-bank'),
        api.get('/placements/jobs'),
        api.get('/community/discussions'),
      ]);
      setWorkspace(wsRes.data);
      setLiveSessions(lsRes.data.sessions || []);
      setBankQuestions(qbRes.data.questions || []);
      setJobsList(jobRes.data.opportunities || []);
      setDiscussions(discRes.data.discussions || []);

      const firstId = wsRes.data.courses?.[0]?.id ? String(wsRes.data.courses[0].id) : '';
      if (firstId) {
        setModuleForm((p) => (p.courseId ? p : { ...p, courseId: firstId }));
        setLessonForm((p) => (p.courseId ? p : { ...p, courseId: firstId }));
        setAssignForm((p) => (p.courseId ? p : { ...p, courseId: firstId }));
        setQuizMeta((p) => (p.courseId ? p : { ...p, courseId: firstId }));
        setBankForm((p) => (p.courseId ? p : { ...p, courseId: firstId }));
        setSessionForm((p) => (p.courseId ? p : { ...p, courseId: firstId }));
      }
      if (wsRes.data.quizzes?.[0]?.id && !importTargetQuizId) {
        setImportTargetQuizId(String(wsRes.data.quizzes[0].id));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load instructor workspace.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const loadCourseModules = (cId) => {
    if (!cId) return;
    api.get(`/courses/${cId}`).then((res) => {
      const mods = res.data.course?.modules || [];
      setCourseModules(mods);
      if (mods[0]) setLessonForm((p) => ({ ...p, moduleId: String(mods[0].id) }));
    });
  };

  useEffect(() => {
    if (lessonForm.courseId) loadCourseModules(lessonForm.courseId);
  }, [lessonForm.courseId]);

  const updateLiveInfo = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/instructors/courses/${liveModalCourse.id}/live-info`, { liveSessionInfo: liveText });
      showToast('Live class schedule updated.', 'success');
      setLiveModalCourse(null);
      loadWorkspace();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update live session info.', 'error');
    }
  };

  const addModule = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/courses/${moduleForm.courseId}/modules`, {
        title: moduleForm.title,
        description: moduleForm.description,
      });
      showToast('Course module added!', 'success');
      setModuleForm((p) => ({ ...p, title: '', description: '' }));
      loadCourseModules(lessonForm.courseId);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to add module.', 'error');
    }
  };

  const addLesson = async (e) => {
    e.preventDefault();
    if (!lessonForm.moduleId) {
      showToast('Select a module first.', 'error');
      return;
    }
    try {
      await api.post(`/modules/${lessonForm.moduleId}/lessons`, {
        title: lessonForm.title,
        lessonType: lessonForm.lessonType,
        durationMinutes: Number(lessonForm.durationMinutes),
        content: lessonForm.content,
      });
      showToast('Lesson published to course module!', 'success');
      setLessonForm((p) => ({ ...p, title: '', content: '' }));
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to add lesson.', 'error');
    }
  };

  const createAssignment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/assignments', assignForm);
      showToast('Assignment created for enrolled students.', 'success');
      setAssignForm((p) => ({ ...p, title: '', description: '' }));
      loadWorkspace();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create assignment.', 'error');
    }
  };

  const updateQuizQuestion = (idx, patch) => {
    setQuizQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const createQuiz = async (e) => {
    e.preventDefault();
    try {
      const formattedQuestions = quizQuestions.map((q) => {
        if (q.questionType === 'SHORT_ANSWER') {
          const accepted = q.shortAnswerText.split(',').map((s) => s.trim()).filter(Boolean);
          return {
            questionText: q.questionText,
            questionType: 'SHORT_ANSWER',
            options: [],
            correctOptionIndex: 0,
            correctAnswers: accepted,
            difficulty: q.difficulty,
            skillTag: q.skillTag,
            marks: Number(q.marks) || 1,
            explanation: q.explanation,
          };
        }
        if (q.questionType === 'TRUE_FALSE') {
          return {
            questionText: q.questionText,
            questionType: 'TRUE_FALSE',
            options: ['True', 'False'],
            correctOptionIndex: Number(q.correctOptionIndex) === 1 ? 1 : 0,
            correctAnswers: [Number(q.correctOptionIndex) === 1 ? 1 : 0],
            difficulty: q.difficulty,
            skillTag: q.skillTag,
            marks: Number(q.marks) || 1,
            explanation: q.explanation,
          };
        }
        if (q.questionType === 'MULTI_SELECT') {
          return {
            questionText: q.questionText,
            questionType: 'MULTI_SELECT',
            options: q.options,
            correctOptionIndex: q.correctMultiIndices[0] ?? 0,
            correctAnswers: q.correctMultiIndices,
            difficulty: q.difficulty,
            skillTag: q.skillTag,
            marks: Number(q.marks) || 1,
            explanation: q.explanation,
          };
        }
        return {
          questionText: q.questionText,
          questionType: 'MCQ',
          options: q.options,
          correctOptionIndex: Number(q.correctOptionIndex),
          correctAnswers: [Number(q.correctOptionIndex)],
          difficulty: q.difficulty,
          skillTag: q.skillTag,
          marks: Number(q.marks) || 1,
          explanation: q.explanation,
        };
      });

      await api.post('/quizzes', {
        ...quizMeta,
        courseId: Number(quizMeta.courseId),
        passingScore: Number(quizMeta.passingScore),
        timeLimitMinutes: Number(quizMeta.timeLimitMinutes),
        negativeMarksPerWrong: Number(quizMeta.negativeMarksPerWrong),
        questions: formattedQuestions,
      });
      showToast('Advanced quiz created and published!', 'success');
      setQuizMeta((p) => ({ ...p, title: '', description: '' }));
      setQuizQuestions([EMPTY_QUESTION()]);
      loadWorkspace();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create quiz.', 'error');
    }
  };

  const addBankQuestion = async (e) => {
    e.preventDefault();
    try {
      await api.post('/question-bank', {
        courseId: bankForm.courseId ? Number(bankForm.courseId) : null,
        questionText: bankForm.questionText,
        questionType: bankForm.questionType,
        options:
          bankForm.questionType === 'TRUE_FALSE'
            ? ['True', 'False']
            : [bankForm.opt0, bankForm.opt1, bankForm.opt2, bankForm.opt3],
        correctOptionIndex: Number(bankForm.correctOptionIndex),
        difficulty: bankForm.difficulty,
        skillTag: bankForm.skillTag,
        explanation: bankForm.explanation,
      });
      showToast('Added question to Question Bank.', 'success');
      setBankForm((p) => ({ ...p, questionText: '', opt0: '', opt1: '', opt2: '', opt3: '', explanation: '' }));
      const qb = await api.get('/question-bank');
      setBankQuestions(qb.data.questions || []);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to save question.', 'error');
    }
  };

  const importSelectedToQuiz = async () => {
    if (!importTargetQuizId || !selectedBankIds.length) {
      showToast('Select a quiz and at least one bank question.', 'error');
      return;
    }
    try {
      const res = await api.post(`/quizzes/${importTargetQuizId}/import-bank`, {
        questionIds: selectedBankIds,
      });
      showToast(`Imported ${res.data.imported} questions into quiz.`, 'success');
      setSelectedBankIds([]);
      loadWorkspace();
    } catch (err) {
      showToast(err.response?.data?.message || 'Import failed.', 'error');
    }
  };

  const deleteBankQuestion = async (id) => {
    await api.delete(`/question-bank/${id}`);
    setBankQuestions((prev) => prev.filter((q) => q.id !== id));
    showToast('Question removed from bank.', 'info');
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/assignments/submissions/${reviewModal.id}/review`, {
        score: Number(reviewScore),
        status: 'REVIEWED',
        instructorFeedback: reviewFeedback,
      });
      showToast('Submission graded and feedback sent.', 'success');
      setReviewModal(null);
      loadWorkspace();
    } catch (err) {
      showToast(err.response?.data?.message || 'Review failed.', 'error');
    }
  };

  const scheduleLiveSession = async (e) => {
    e.preventDefault();
    try {
      await api.post('/live-sessions', sessionForm);
      showToast('Live class scheduled and enrolled students notified!', 'success');
      setSessionForm((p) => ({ ...p, title: '', description: '' }));
      const lsRes = await api.get('/live-sessions');
      setLiveSessions(lsRes.data.sessions || []);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to schedule live class.', 'error');
    }
  };

  const cancelLiveSession = async (id) => {
    try {
      await api.patch(`/live-sessions/${id}/cancel`, { reason: 'Rescheduled by mentor' });
      showToast('Session cancelled and students notified.', 'info');
      const lsRes = await api.get('/live-sessions');
      setLiveSessions(lsRes.data.sessions || []);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel session.', 'error');
    }
  };

  const openRoster = async (session) => {
    try {
      const res = await api.get(`/live-sessions/${session.id}/attendance`);
      setRosterModal(res.data.session);
      setRosterList(res.data.roster || []);
    } catch {
      showToast('Unable to load attendance roster.', 'error');
    }
  };

  const markAttendanceStatus = async (userId, status) => {
    if (!rosterModal) return;
    try {
      await api.post(`/live-sessions/${rosterModal.id}/attendance/mark`, { userId, status });
      setRosterList((prev) => prev.map((r) => (r.user_id === userId ? { ...r, status } : r)));
      showToast(`Attendance marked ${status}.`, 'success');
    } catch {
      showToast('Failed to mark attendance.', 'error');
    }
  };

  const sendRecommendation = async (e) => {
    e.preventDefault();
    if (!recommendModal) return;
    try {
      await api.post('/placements/recommend', {
        studentId: recommendModal.user_id,
        courseId: recommendModal.course_id,
        opportunityId: recommendForm.opportunityId ? Number(recommendForm.opportunityId) : null,
        endorsementNote: recommendForm.endorsementNote,
      });
      showToast(`Recommendation sent for ${recommendModal.full_name}!`, 'success');
      setRecommendModal(null);
      setRecommendForm({ opportunityId: '', endorsementNote: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to endorse student.', 'error');
    }
  };

  const openThread = async (id) => {
    const res = await api.get(`/community/discussions/${id}`);
    setActiveThread(res.data);
  };

  const postReply = async (e) => {
    e.preventDefault();
    if (!activeThread || !replyText.trim()) return;
    await api.post(`/community/discussions/${activeThread.discussion.id}/replies`, { content: replyText });
    setReplyText('');
    openThread(activeThread.discussion.id);
    const dRes = await api.get('/community/discussions');
    setDiscussions(dRes.data.discussions || []);
  };

  const acceptReply = async (replyId) => {
    await api.patch(`/community/replies/${replyId}/accept`);
    showToast('Marked as official accepted solution (+15 XP)!', 'success');
    if (activeThread) openThread(activeThread.discussion.id);
  };

  const navItems = [
    { id: 'courses', label: 'Assigned Courses', icon: BookOpen },
    { id: 'students', label: 'Enrolled Students', icon: Users },
    { id: 'lessons', label: 'Curriculum & Lessons', icon: FilePlus },
    { id: 'live-classes', label: 'Live Classes', icon: Video },
    { id: 'submissions', label: 'Submissions & Grades', icon: ClipboardList },
    { id: 'assessments', label: 'Quizzes & Tasks', icon: CheckSquare },
    { id: 'question-bank', label: 'Question Bank', icon: Database },
    { id: 'community', label: 'Community Q&A', icon: MessageCircle },
  ];

  return (
    <DashboardLayout
      title="Instructor Teaching Console"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {loading ? (
        <Loader label="Loading instructor workspace..." />
      ) : (
        <div className="space-y-6">
          {activeTab === 'courses' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {workspace.courses.map((c) => (
                <Card key={c.id} className="p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{c.category_name} · {c.duration}</p>
                    <h3 className="font-display text-lg font-bold text-slate-900 mt-1">{c.title}</h3>
                    <p className="text-xs text-slate-600 mt-2">{c.live_session_info}</p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-700 tabular-nums">
                      {c.active_students} enrolled learners
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setLiveModalCourse(c);
                        setLiveText(c.live_session_info || '');
                      }}
                    >
                      <Video className="w-3.5 h-3.5" /> Update Live Info
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'students' && (
            <Card className="p-6">
              <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Enrolled Students & Placement Readiness</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4">Student</th>
                      <th className="py-2.5 pr-4">Email</th>
                      <th className="py-2.5 pr-4">Course</th>
                      <th className="py-2.5 pr-4 text-right">Progress</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5">Placement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workspace.students.map((s) => (
                      <tr key={s.id}>
                        <td className="py-3 pr-4 font-medium">{s.full_name}</td>
                        <td className="py-3 pr-4 text-slate-600">{s.email}</td>
                        <td className="py-3 pr-4 text-slate-700">{s.course_title}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{s.progress_percent}%</td>
                        <td className="py-3 pr-4"><StatusText status={s.status} /></td>
                        <td className="py-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setRecommendModal(s);
                              setRecommendForm({ opportunityId: '', endorsementNote: '' });
                            }}
                          >
                            <Award className="w-3.5 h-3.5" /> Recommend
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'lessons' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-5 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Create New Module</h3>
                <form onSubmit={addModule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Course</label>
                    <select
                      value={moduleForm.courseId}
                      onChange={(e) => setModuleForm({ ...moduleForm, courseId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {workspace.courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Module Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Module 3: Distributed Caching & Queues"
                      value={moduleForm.title}
                      onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={moduleForm.description}
                      onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <Button type="submit" variant="navy">Add Module</Button>
                </form>
              </Card>

              <Card className="lg:col-span-7 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Publish New Lesson / Material</h3>
                <form onSubmit={addLesson} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Course</label>
                      <select
                        value={lessonForm.courseId}
                        onChange={(e) => setLessonForm({ ...lessonForm, courseId: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        {workspace.courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Module</label>
                      <select
                        value={lessonForm.moduleId}
                        onChange={(e) => setLessonForm({ ...lessonForm, moduleId: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        {courseModules.map((m) => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Lesson Title *</label>
                      <input
                        type="text"
                        required
                        value={lessonForm.title}
                        onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                      <select
                        value={lessonForm.lessonType}
                        onChange={(e) => setLessonForm({ ...lessonForm, lessonType: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="VIDEO">Video Lesson</option>
                        <option value="READING">Reading Material</option>
                        <option value="LAB">Hands-On Lab</option>
                        <option value="LIVE">Live Session Recording</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Lesson Content / Lab Notes *</label>
                    <textarea
                      rows={4}
                      required
                      value={lessonForm.content}
                      onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <Button type="submit">Publish Lesson</Button>
                </form>
              </Card>
            </div>
          )}

          {activeTab === 'live-classes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-5 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Schedule Live Class</h3>
                <form onSubmit={scheduleLiveSession} className="space-y-3">
                  <select
                    value={sessionForm.courseId}
                    onChange={(e) => setSessionForm({ ...sessionForm, courseId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {workspace.courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Session Title"
                    value={sessionForm.title}
                    onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <textarea
                    rows={2}
                    required
                    placeholder="Agenda & topics covered..."
                    value={sessionForm.description}
                    onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="url"
                    required
                    placeholder="https://meet.google.com/... or https://zoom.us/..."
                    value={sessionForm.meetingUrl}
                    onChange={(e) => setSessionForm({ ...sessionForm, meetingUrl: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={sessionForm.meetingPlatform}
                      onChange={(e) => setSessionForm({ ...sessionForm, meetingPlatform: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Google Meet">Google Meet</option>
                      <option value="Zoom">Zoom</option>
                    </select>
                    <input
                      type="number"
                      min={15}
                      max={240}
                      value={sessionForm.durationMinutes}
                      onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <input
                    type="datetime-local"
                    required
                    value={sessionForm.scheduledAt}
                    onChange={(e) => setSessionForm({ ...sessionForm, scheduledAt: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <Button type="submit" className="w-full">Schedule & Notify Cohort</Button>
                </form>
              </Card>

              <Card className="lg:col-span-7 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Scheduled Live Sessions</h3>
                <div className="space-y-3">
                  {liveSessions.map((ls) => (
                    <div key={ls.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs text-violet-700">
                          {ls.course_title} · {ls.meeting_platform} · {ls.attended_count || 0} attended
                        </p>
                        <h4 className="font-display text-base font-bold text-slate-900 mt-0.5">{ls.title}</h4>
                        <p className="text-xs text-slate-600 mt-1">{new Date(ls.scheduled_at).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <StatusText status={ls.status} />
                        <Button size="sm" variant="secondary" onClick={() => openRoster(ls)}>
                          Attendance Roster
                        </Button>
                        {ls.status === 'SCHEDULED' && (
                          <Button size="sm" variant="danger" onClick={() => cancelLiveSession(ls.id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'submissions' && (
            <Card className="p-6">
              <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Assignment Submissions</h3>
              {workspace.submissions.length === 0 ? (
                <p className="text-sm text-slate-500">No student assignment submissions pending review.</p>
              ) : (
                <div className="space-y-3">
                  {workspace.submissions.map((sub) => (
                    <div key={sub.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-500">{sub.course_title} · {sub.student_name}</p>
                        <h4 className="font-semibold text-sm text-slate-900 mt-0.5">{sub.assignment_title}</h4>
                        {sub.submission_notes && <p className="text-xs text-slate-600 mt-1">{sub.submission_notes}</p>}
                        {sub.submission_url && (
                          <a href={sub.submission_url} target="_blank" rel="noreferrer" className="text-xs text-violet-700 underline mt-1 inline-block">
                            View Attached Deliverable
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusText status={sub.status} />
                        <Button
                          size="sm"
                          onClick={() => {
                            setReviewModal(sub);
                            setReviewScore(sub.score || 90);
                            setReviewFeedback(sub.instructor_feedback || '');
                          }}
                        >
                          Grade & Feedback
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'assessments' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-4 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Create Assignment</h3>
                <form onSubmit={createAssignment} className="space-y-4">
                  <select
                    value={assignForm.courseId}
                    onChange={(e) => setAssignForm({ ...assignForm, courseId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {workspace.courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Assignment Title"
                    value={assignForm.title}
                    onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <textarea
                    rows={3}
                    required
                    placeholder="Instructions & rubric..."
                    value={assignForm.description}
                    onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="date"
                    value={assignForm.dueDate}
                    onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <Button type="submit">Publish Assignment</Button>
                </form>
              </Card>

              <Card className="lg:col-span-8 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">
                  Create Advanced Timed Quiz
                </h3>
                <form onSubmit={createQuiz} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={quizMeta.courseId}
                      onChange={(e) => setQuizMeta({ ...quizMeta, courseId: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {workspace.courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Quiz Title"
                      value={quizMeta.title}
                      onChange={(e) => setQuizMeta({ ...quizMeta, title: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-500 mb-1">Passing %</label>
                      <input type="number" min={10} max={100} value={quizMeta.passingScore} onChange={(e) => setQuizMeta({ ...quizMeta, passingScore: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Time Limit (mins)</label>
                      <input type="number" min={1} max={180} value={quizMeta.timeLimitMinutes} onChange={(e) => setQuizMeta({ ...quizMeta, timeLimitMinutes: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg" />
                    </div>
                    <label className="flex items-center gap-2 pt-4 cursor-pointer">
                      <input type="checkbox" checked={quizMeta.randomizeQuestions} onChange={(e) => setQuizMeta({ ...quizMeta, randomizeQuestions: e.target.checked })} />
                      <span>Randomize Order</span>
                    </label>
                    <label className="flex items-center gap-2 pt-4 cursor-pointer">
                      <input type="checkbox" checked={quizMeta.allowNegativeMarking} onChange={(e) => setQuizMeta({ ...quizMeta, allowNegativeMarking: e.target.checked })} />
                      <span>Negative Marking (-0.25)</span>
                    </label>
                  </div>

                  <div className="space-y-4">
                    {quizQuestions.map((q, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-violet-700">QUESTION #{idx + 1}</span>
                          {quizQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setQuizQuestions((p) => p.filter((_, i) => i !== idx))}
                              className="text-xs text-rose-600 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Question prompt"
                          value={q.questionText}
                          onChange={(e) => updateQuizQuestion(idx, { questionText: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={q.questionType}
                            onChange={(e) => updateQuizQuestion(idx, { questionType: e.target.value })}
                            className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                          >
                            <option value="MCQ">Single MCQ</option>
                            <option value="MULTI_SELECT">Multi-Select</option>
                            <option value="TRUE_FALSE">True / False</option>
                            <option value="SHORT_ANSWER">Short Answer</option>
                          </select>
                          <select
                            value={q.difficulty}
                            onChange={(e) => updateQuizQuestion(idx, { difficulty: e.target.value })}
                            className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Skill Tag"
                            value={q.skillTag}
                            onChange={(e) => updateQuizQuestion(idx, { skillTag: e.target.value })}
                            className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        {q.questionType === 'SHORT_ANSWER' ? (
                          <input
                            type="text"
                            required
                            placeholder="Accepted keywords / answers (comma-separated)"
                            value={q.shortAnswerText}
                            onChange={(e) => updateQuizQuestion(idx, { shortAnswerText: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                        ) : q.questionType === 'TRUE_FALSE' ? (
                          <select
                            value={q.correctOptionIndex}
                            onChange={(e) => updateQuizQuestion(idx, { correctOptionIndex: Number(e.target.value) })}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          >
                            <option value={0}>Correct: True</option>
                            <option value={1}>Correct: False</option>
                          </select>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => (
                                <input
                                  key={oIdx}
                                  type="text"
                                  required
                                  placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const nextOpts = [...q.options];
                                    nextOpts[oIdx] = e.target.value;
                                    updateQuizQuestion(idx, { options: nextOpts });
                                  }}
                                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                                />
                              ))}
                            </div>
                            {q.questionType === 'MULTI_SELECT' ? (
                              <div className="flex flex-wrap gap-3 text-xs">
                                <span className="text-slate-600">Correct options:</span>
                                {[0, 1, 2, 3].map((oIdx) => (
                                  <label key={oIdx} className="inline-flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={q.correctMultiIndices.includes(oIdx)}
                                      onChange={(e) => {
                                        const next = e.target.checked
                                          ? [...q.correctMultiIndices, oIdx]
                                          : q.correctMultiIndices.filter((x) => x !== oIdx);
                                        updateQuizQuestion(idx, { correctMultiIndices: next });
                                      }}
                                    />
                                    <span>{String.fromCharCode(65 + oIdx)}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <select
                                value={q.correctOptionIndex}
                                onChange={(e) => updateQuizQuestion(idx, { correctOptionIndex: Number(e.target.value) })}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                              >
                                <option value={0}>Correct: Option A</option>
                                <option value={1}>Correct: Option B</option>
                                <option value={2}>Correct: Option C</option>
                                <option value={3}>Correct: Option D</option>
                              </select>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setQuizQuestions((p) => [...p, EMPTY_QUESTION()])}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Another Question
                    </Button>
                    <Button type="submit">Publish Quiz ({quizQuestions.length} Qs)</Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {activeTab === 'question-bank' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-5 p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Add Question to Bank</h3>
                <form onSubmit={addBankQuestion} className="space-y-3">
                  <select
                    value={bankForm.courseId}
                    onChange={(e) => setBankForm({ ...bankForm, courseId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">General / Cross-Course</option>
                    {workspace.courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Question Text"
                    value={bankForm.questionText}
                    onChange={(e) => setBankForm({ ...bankForm, questionText: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <select value={bankForm.questionType} onChange={(e) => setBankForm({ ...bankForm, questionType: e.target.value })} className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                      <option value="MCQ">MCQ</option>
                      <option value="TRUE_FALSE">True / False</option>
                    </select>
                    <select value={bankForm.difficulty} onChange={(e) => setBankForm({ ...bankForm, difficulty: e.target.value })} className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                    <input type="text" placeholder="Skill Tag" value={bankForm.skillTag} onChange={(e) => setBankForm({ ...bankForm, skillTag: e.target.value })} className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg" />
                  </div>
                  {bankForm.questionType !== 'TRUE_FALSE' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" required placeholder="Option A" value={bankForm.opt0} onChange={(e) => setBankForm({ ...bankForm, opt0: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                      <input type="text" required placeholder="Option B" value={bankForm.opt1} onChange={(e) => setBankForm({ ...bankForm, opt1: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                      <input type="text" required placeholder="Option C" value={bankForm.opt2} onChange={(e) => setBankForm({ ...bankForm, opt2: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                      <input type="text" required placeholder="Option D" value={bankForm.opt3} onChange={(e) => setBankForm({ ...bankForm, opt3: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                    </div>
                  )}
                  <select value={bankForm.correctOptionIndex} onChange={(e) => setBankForm({ ...bankForm, correctOptionIndex: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    <option value={0}>{bankForm.questionType === 'TRUE_FALSE' ? 'True' : 'Option A'}</option>
                    <option value={1}>{bankForm.questionType === 'TRUE_FALSE' ? 'False' : 'Option B'}</option>
                    {bankForm.questionType !== 'TRUE_FALSE' && <option value={2}>Option C</option>}
                    {bankForm.questionType !== 'TRUE_FALSE' && <option value={3}>Option D</option>}
                  </select>
                  <Button type="submit" className="w-full">Save to Bank</Button>
                </form>
              </Card>

              <Card className="lg:col-span-7 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Question Bank ({bankQuestions.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={importTargetQuizId}
                      onChange={(e) => setImportTargetQuizId(e.target.value)}
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white max-w-[180px]"
                    >
                      <option value="">Select target quiz...</option>
                      {(workspace.quizzes || []).map((qz) => (
                        <option key={qz.id} value={qz.id}>{qz.title}</option>
                      ))}
                    </select>
                    <Button size="sm" onClick={importSelectedToQuiz} disabled={!selectedBankIds.length}>
                      Import ({selectedBankIds.length})
                    </Button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
                  {bankQuestions.map((q) => {
                    const checked = selectedBankIds.includes(q.id);
                    return (
                      <div key={q.id} className="p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedBankIds((p) =>
                              e.target.checked ? [...p, q.id] : p.filter((x) => x !== q.id)
                            )
                          }
                          className="mt-1 accent-violet-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{q.question_text}</p>
                          <p className="font-mono text-[11px] text-slate-500 mt-1">
                            {q.question_type} · {q.difficulty} · {q.skill_tag}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteBankQuestion(q.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'community' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-3">
                {discussions.map((d) => (
                  <Card
                    key={d.id}
                    className={`p-4 cursor-pointer ${
                      activeThread?.discussion?.id === d.id ? 'border-violet-600 bg-violet-50/40' : 'hover:border-violet-300'
                    }`}
                  >
                    <div onClick={() => openThread(d.id)}>
                      <p className="font-mono text-[11px] text-violet-700">{d.course_title}</p>
                      <h4 className="font-display text-sm font-bold text-slate-900 mt-1">{d.title}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {d.author_name} · {d.replies_count} replies
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="lg:col-span-7">
                {!activeThread ? (
                  <Card className="p-8 text-center text-sm text-slate-500">
                    Select a student question to mentor and verify accepted solutions.
                  </Card>
                ) : (
                  <Card className="p-6 space-y-4">
                    <div className="pb-3 border-b border-slate-200">
                      <h3 className="font-display text-lg font-bold text-slate-900">{activeThread.discussion.title}</h3>
                      <p className="text-sm text-slate-700 mt-2">{activeThread.discussion.content}</p>
                    </div>
                    <div className="space-y-3">
                      {activeThread.replies.map((r) => (
                        <div key={r.id} className={`p-3.5 rounded-xl border ${r.is_accepted ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold">{r.author_name} ({r.author_role})</span>
                            {r.is_accepted ? (
                              <span className="font-mono text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> ACCEPTED
                              </span>
                            ) : (
                              <button type="button" onClick={() => acceptReply(r.id)} className="text-emerald-700 font-semibold hover:underline cursor-pointer">
                                Mark Accepted
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mt-1.5">{r.content}</p>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={postReply} className="pt-3 border-t border-slate-200 flex gap-3">
                      <input
                        type="text"
                        required
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Post mentor guidance..."
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                      <Button type="submit" size="sm">
                        <Send className="w-3.5 h-3.5" /> Reply
                      </Button>
                    </form>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={Boolean(liveModalCourse)} onClose={() => setLiveModalCourse(null)} title="Update Live Session Schedule">
        <form onSubmit={updateLiveInfo} className="space-y-4">
          <textarea
            rows={3}
            required
            value={liveText}
            onChange={(e) => setLiveText(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <Button type="submit">Save Schedule</Button>
        </form>
      </Modal>

      <Modal open={Boolean(reviewModal)} onClose={() => setReviewModal(null)} title="Grade Assignment Submission">
        <form onSubmit={submitReview} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Score (out of 100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={reviewScore}
              onChange={(e) => setReviewScore(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mentor Feedback</label>
            <textarea
              rows={3}
              required
              value={reviewFeedback}
              onChange={(e) => setReviewFeedback(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <Button type="submit">Submit Grade</Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(rosterModal)}
        onClose={() => setRosterModal(null)}
        title={`Attendance Roster · ${rosterModal?.title || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          {rosterList.length === 0 ? (
            <p className="text-sm text-slate-500">No students enrolled in this course yet.</p>
          ) : (
            rosterList.map((r) => (
              <div key={r.user_id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {r.email} {r.joined_at ? `· Joined ${formatDate(r.joined_at)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusText status={r.status} />
                  <select
                    value={r.status}
                    onChange={(e) => markAttendanceStatus(r.user_id, e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="LATE">LATE</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(recommendModal)}
        onClose={() => setRecommendModal(null)}
        title={`Recommend ${recommendModal?.full_name || ''} for Placement`}
      >
        <form onSubmit={sendRecommendation} className="space-y-4">
          <select
            value={recommendForm.opportunityId}
            onChange={(e) => setRecommendForm({ ...recommendForm, opportunityId: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">General Placement Endorsement (All Roles)</option>
            {jobsList.map((j) => (
              <option key={j.id} value={j.id}>{j.title} — {j.company_name}</option>
            ))}
          </select>
          <textarea
            rows={3}
            required
            placeholder="Describe student technical strengths, capstone quality, and interview readiness..."
            value={recommendForm.endorsementNote}
            onChange={(e) => setRecommendForm({ ...recommendForm, endorsementNote: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <Button type="submit" className="w-full">Send Endorsement</Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
