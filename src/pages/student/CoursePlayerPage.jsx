import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileText,
  Upload,
} from 'lucide-react';
import { Button, Card, Loader, StatusText } from '../../components/DesignSystem.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { downloadCertificatePdf } from '../../utils/formatters.js';

function formatTimer(secs) {
  const s = Math.max(0, Number(secs) || 0);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function CoursePlayerPage() {
  const { courseId } = useParams();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [viewMode, setViewMode] = useState('lesson'); // lesson | quiz | assignment
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  const [assignmentFile, setAssignmentFile] = useState(null);
  const [assignmentUrl, setAssignmentUrl] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  const submitQuizRef = useRef(null);

  const fetchCourse = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/learning/courses/${courseId}`);
      setData(res.data);
      const firstLesson = res.data.modules?.[0]?.lessons?.[0] || null;
      if (!activeLesson && firstLesson) setActiveLesson(firstLesson);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load course player.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  const startQuiz = (q) => {
    setActiveQuiz(q);
    setQuizResult(null);
    setQuizAnswers({});
    setSecondsLeft((Number(q.timeLimitMinutes) || 15) * 60);
    setViewMode('quiz');
  };

  const toggleLessonComplete = async (lesson) => {
    try {
      const nextDone = !lesson.completed;
      const res = await api.post('/progress/toggle', {
        courseId: Number(courseId),
        lessonId: lesson.id,
        completed: nextDone,
      });
      setData((prev) => ({
        ...prev,
        enrollment: { ...prev.enrollment, progress_percent: res.data.progressPercent },
        modules: prev.modules.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, completed: nextDone } : l)),
        })),
      }));
      if (activeLesson?.id === lesson.id) {
        setActiveLesson((prev) => ({ ...prev, completed: nextDone }));
      }
      const xpMsg = res.data.xpEarned > 0 ? ` · +${res.data.xpEarned} XP` : '';
      showToast(
        nextDone
          ? `Lesson complete (${res.data.progressPercent}% overall)${xpMsg}`
          : 'Lesson marked incomplete',
        'success'
      );
    } catch {
      showToast('Failed to update progress.', 'error');
    }
  };

  const submitQuiz = useCallback(
    async (autoSubmitted = false) => {
      if (!activeQuiz || quizSubmitting) return;
      setQuizSubmitting(true);
      const totalSeconds = (Number(activeQuiz.timeLimitMinutes) || 15) * 60;
      const timeTakenSeconds = Math.max(1, totalSeconds - (secondsLeft ?? totalSeconds));
      try {
        const res = await api.post(`/quizzes/${activeQuiz.id}/submit`, {
          answers: quizAnswers,
          timeTakenSeconds,
        });
        setQuizResult(res.data);
        setSecondsLeft(null);
        const xpMsg = res.data.xpEarned > 0 ? ` · +${res.data.xpEarned} XP!` : '';
        showToast(
          `${autoSubmitted ? 'Time expired — auto-submitted! ' : ''}Quiz scored: ${res.data.attempt.percentage}%${xpMsg}`,
          res.data.attempt.passed ? 'success' : 'info'
        );
        fetchCourse();
      } catch (err) {
        showToast(err.response?.data?.message || 'Quiz submission failed.', 'error');
      } finally {
        setQuizSubmitting(false);
      }
    },
    [activeQuiz, quizAnswers, quizSubmitting, secondsLeft]
  );

  useEffect(() => {
    submitQuizRef.current = submitQuiz;
  }, [submitQuiz]);

  // Countdown timer when a quiz is actively being attempted
  useEffect(() => {
    if (viewMode !== 'quiz' || !activeQuiz || quizResult || secondsLeft === null) return undefined;
    if (secondsLeft <= 0) {
      submitQuizRef.current?.(true);
      return undefined;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [viewMode, activeQuiz, quizResult, secondsLeft]);

  const toggleMultiOption = (qId, optIdx) => {
    setQuizAnswers((prev) => {
      const current = Array.isArray(prev[qId]) ? prev[qId] : [];
      const exists = current.includes(optIdx);
      const next = exists ? current.filter((x) => x !== optIdx) : [...current, optIdx];
      return { ...prev, [qId]: next };
    });
  };

  const submitAssignment = async (assignmentId) => {
    setSubmittingAssignment(true);
    try {
      const fd = new FormData();
      if (assignmentFile) fd.append('file', assignmentFile);
      if (assignmentUrl) fd.append('submissionUrl', assignmentUrl);
      if (assignmentNotes) fd.append('submissionNotes', assignmentNotes);
      await api.post(`/assignments/${assignmentId}/submit`, fd);
      showToast('Assignment submitted for mentor review!', 'success');
      setAssignmentFile(null);
      setAssignmentUrl('');
      setAssignmentNotes('');
      fetchCourse();
    } catch (err) {
      showToast(err.response?.data?.message || 'Submission failed.', 'error');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const generateCert = async () => {
    try {
      const res = await api.post('/certificates/generate', { courseId: Number(courseId) });
      setData((prev) => ({ ...prev, certificate: res.data.certificate }));
      showToast('Certificate issued!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Complete all lessons first.', 'error');
    }
  };

  if (loading) return <Loader label="Loading course player..." />;
  if (!data) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center px-4">
        <p className="text-slate-600">Enrollment access required to open this workspace.</p>
        <Link to="/student" className="mt-4 inline-block text-violet-700 font-semibold underline">
          Return to Student Dashboard
        </Link>
      </div>
    );
  }

  const progressPct = data.enrollment?.progress_percent || 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-[#0A0F24] text-white px-4 sm:px-6 h-16 flex items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/student" className="text-slate-300 hover:text-white flex items-center gap-1.5 text-sm shrink-0">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <span className="text-slate-600">|</span>
          <h1 className="font-display text-sm sm:text-base font-bold truncate">{data.course.title}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/student/ai-assistant"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-violet-300"
          >
            <Bot className="w-3.5 h-3.5" /> AI Tutor
          </Link>
          <span className="font-mono text-xs text-violet-300 tabular-nums">{progressPct}% Complete</span>
          {data.certificate ? (
            <Button size="sm" variant="light" onClick={() => downloadCertificatePdf(data.certificate)}>
              <Award className="w-4 h-4" /> Certificate PDF
            </Button>
          ) : (
            progressPct === 100 && (
              <Button size="sm" onClick={generateCert}>
                <Award className="w-4 h-4" /> Claim Certificate
              </Button>
            )
          )}
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Curriculum Sidebar */}
        <aside className="lg:col-span-4 space-y-4">
          <Card className="p-4">
            <h2 className="font-display text-sm font-bold text-slate-900 mb-3">Course Modules & Units</h2>
            <div className="space-y-4">
              {data.modules.map((mod) => (
                <div key={mod.id}>
                  <p className="text-xs font-bold text-slate-700 mb-2">{mod.title}</p>
                  <div className="space-y-1">
                    {mod.lessons.map((les) => (
                      <button
                        key={les.id}
                        type="button"
                        onClick={() => {
                          setActiveLesson(les);
                          setViewMode('lesson');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                          viewMode === 'lesson' && activeLesson?.id === les.id
                            ? 'bg-violet-50 text-violet-800 font-semibold'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {les.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="flex-1 truncate">{les.title}</span>
                        <span className="font-mono text-[11px] text-slate-400">{les.durationMinutes}m</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <p className="text-xs font-bold text-slate-700">Assessments & Deliverables</p>
            {data.quizzes.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => startQuiz(q)}
                className={`w-full px-3 py-2 rounded-lg text-left text-xs font-medium cursor-pointer flex items-center justify-between gap-2 ${
                  viewMode === 'quiz' && activeQuiz?.id === q.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                <span className="truncate">Quiz: {q.title}</span>
                <span className="font-mono text-[10px] opacity-80 shrink-0">{q.timeLimitMinutes}m</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setViewMode('assignment')}
              className={`w-full px-3 py-2 rounded-lg text-left text-xs font-medium cursor-pointer ${
                viewMode === 'assignment'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              Capstone Assignments ({data.assignments.length})
            </button>
          </Card>
        </aside>

        {/* Main Viewer */}
        <main className="lg:col-span-8">
          {viewMode === 'lesson' && activeLesson && (
            <Card className="p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <p className="font-mono text-xs text-violet-700">
                    {activeLesson.lessonType} UNIT · {activeLesson.durationMinutes} MIN
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900 mt-1">{activeLesson.title}</h2>
                </div>
                <Button
                  variant={activeLesson.completed ? 'secondary' : 'primary'}
                  onClick={() => toggleLessonComplete(activeLesson)}
                >
                  {activeLesson.completed ? 'Completed ✓' : 'Mark Lesson Complete (+10 XP)'}
                </Button>
              </div>

              {(activeLesson.lessonType === 'VIDEO' || activeLesson.lessonType === 'LIVE') && (
                <div className="aspect-video rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-200 p-6 text-center">
                  <p className="font-mono text-xs text-violet-300 mb-2">HD SESSION STREAM</p>
                  <p className="font-display text-lg font-semibold">{activeLesson.title}</p>
                  <p className="text-xs text-slate-400 mt-2 max-w-md">{data.course.live_session_info}</p>
                </div>
              )}

              <div className="prose prose-slate max-w-none text-sm leading-relaxed whitespace-pre-line text-slate-700">
                {activeLesson.content}
              </div>

              {activeLesson.resourceUrl && (
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <FileText className="w-4 h-4 text-violet-600" />
                    <span>Downloadable Lab Guide & Reference Sheet</span>
                  </div>
                  <a
                    href={activeLesson.resourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Open Resource
                  </a>
                </div>
              )}
            </Card>
          )}

          {viewMode === 'quiz' && activeQuiz && (
            <Card className="p-6 space-y-6">
              <div className="pb-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-violet-700">
                    PASSING SCORE: {activeQuiz.passingScore}% · {activeQuiz.timeLimitMinutes} MINUTES
                    {activeQuiz.randomizeQuestions ? ' · RANDOMIZED' : ''}
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900 mt-1">{activeQuiz.title}</h2>
                  <p className="text-sm text-slate-600 mt-1">{activeQuiz.description}</p>
                </div>

                {!quizResult && secondsLeft !== null && (
                  <div
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-mono text-sm font-bold tabular-nums ${
                      secondsLeft <= 60
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-slate-900 border-slate-800 text-white'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{formatTimer(secondsLeft)}</span>
                  </div>
                )}
              </div>

              {!quizResult && activeQuiz.allowNegativeMarking && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Negative marking enabled: -{activeQuiz.negativeMarksPerWrong} marks deducted per incorrect attempt. Unanswered questions carry zero penalty.
                  </span>
                </div>
              )}

              {quizResult ? (
                <div className="space-y-5">
                  <div
                    className={`p-5 rounded-xl border ${
                      quizResult.attempt.passed
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-lg font-bold text-slate-900">
                        Score: {quizResult.attempt.score} / {quizResult.attempt.total_questions} ({quizResult.attempt.percentage}%)
                      </p>
                      {quizResult.xpEarned > 0 && (
                        <span className="font-mono text-xs font-bold text-emerald-700">
                          +{quizResult.xpEarned} XP EARNED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mt-1">
                      {quizResult.attempt.passed
                        ? 'Assessment Passed! Recorded in PostgreSQL.'
                        : 'Below passing threshold. Review skill breakdown and retry.'}
                    </p>
                    {Number(quizResult.attempt.negative_deducted || 0) > 0 && (
                      <p className="font-mono text-xs text-amber-800 mt-1">
                        Negative marking deduction: -{quizResult.attempt.negative_deducted} marks
                      </p>
                    )}
                  </div>

                  {/* Skill-wise Breakdown */}
                  {quizResult.attempt.skill_breakdown &&
                    Object.keys(quizResult.attempt.skill_breakdown).length > 0 && (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                        <p className="font-display text-xs font-bold text-slate-900">
                          Skill-Wise Performance Breakdown
                        </p>
                        {Object.entries(quizResult.attempt.skill_breakdown).map(([skill, st]) => (
                          <div key={skill} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-700">{skill}</span>
                              <span className="font-mono text-slate-600 tabular-nums">
                                {st.correct}/{st.total} ({st.percentage}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-600"
                                style={{ width: `${st.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  <div className="space-y-3">
                    {quizResult.breakdown.map((b, i) => (
                      <div key={b.questionId} className="p-3.5 rounded-lg border border-slate-200 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-900">
                            Question {i + 1}:{' '}
                            <span className={b.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                              {b.isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          </p>
                          <span className="font-mono text-[11px] text-slate-500">
                            {b.skillTag} · {b.difficulty}
                          </span>
                        </div>
                        {b.explanation && <p className="text-xs text-slate-600 mt-1">{b.explanation}</p>}
                      </div>
                    ))}
                  </div>

                  <Button onClick={() => startQuiz(activeQuiz)}>Retake Quiz</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeQuiz.questions.map((q, idx) => (
                    <div key={q.id} className="space-y-2.5 pb-4 border-b border-slate-100 last:border-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-sm text-slate-900">
                          {idx + 1}. {q.questionText}
                        </p>
                        <span className="font-mono text-[11px] text-slate-500 shrink-0">
                          {q.questionType.replace('_', ' ')} · {q.difficulty} · {q.skillTag} · {q.marks}pt
                        </span>
                      </div>

                      {q.questionType === 'SHORT_ANSWER' ? (
                        <input
                          type="text"
                          value={quizAnswers[q.id] || ''}
                          onChange={(e) => setQuizAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Type your concise technical answer..."
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                        />
                      ) : q.questionType === 'MULTI_SELECT' ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">Select all matching options:</p>
                          {q.options.map((opt, optIdx) => {
                            const selectedArr = Array.isArray(quizAnswers[q.id]) ? quizAnswers[q.id] : [];
                            const checked = selectedArr.includes(optIdx);
                            return (
                              <label
                                key={optIdx}
                                className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer ${
                                  checked ? 'border-violet-600 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleMultiOption(q.id, optIdx)}
                                  className="accent-violet-600"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer ${
                                quizAnswers[q.id] === optIdx
                                  ? 'border-violet-600 bg-violet-50'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={quizAnswers[q.id] === optIdx}
                                onChange={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <Button loading={quizSubmitting} onClick={() => submitQuiz(false)}>
                    Submit Quiz Answers
                  </Button>
                </div>
              )}
            </Card>
          )}

          {viewMode === 'assignment' && (
            <div className="space-y-5">
              {data.assignments.map((a) => (
                <Card key={a.id} className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-slate-500">
                        DUE {a.due_date} · MAX {a.max_score} PTS
                      </p>
                      <h3 className="font-display text-lg font-bold text-slate-900 mt-1">{a.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{a.description}</p>
                    </div>
                    <StatusText status={a.submission_status || 'PENDING'} />
                  </div>

                  {a.instructor_feedback && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      <strong>Mentor Review ({a.score}/{a.max_score}):</strong> {a.instructor_feedback}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <input
                      type="url"
                      value={assignmentUrl}
                      onChange={(e) => setAssignmentUrl(e.target.value)}
                      placeholder="GitHub Repository or Deployed URL (optional if uploading file)"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <textarea
                      rows={2}
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      placeholder="Architecture notes or verification summary..."
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50">
                        <Upload className="w-4 h-4 text-violet-600" />
                        <span>{assignmentFile ? assignmentFile.name : 'Attach PDF / ZIP / Image (Max 5MB)'}</span>
                        <input
                          type="file"
                          onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                      <Button loading={submittingAssignment} onClick={() => submitAssignment(a.id)}>
                        Submit Assignment
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
