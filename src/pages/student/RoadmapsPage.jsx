import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  Compass,
  FolderGit2,
  HelpCircle,
  Target,
} from 'lucide-react';
import { Button, Card, Loader, Modal, SectionHeading } from '../../components/DesignSystem.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';

export default function RoadmapsPage() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [roadmaps, setRoadmaps] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState('');

  // Diagnostic Assessment Modal
  const [assessOpen, setAssessOpen] = useState(false);
  const [assessAnswers, setAssessAnswers] = useState({});
  const [assessResult, setAssessResult] = useState(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await api.get('/roadmaps');
      const list = res.data.roadmaps || [];
      setRoadmaps(list);
      const primary = list.find((r) => r.studentProgress?.isPrimary) || list[0];
      if (primary && !selectedSlug) {
        await loadDetail(primary.slug);
      }
    } catch {
      showToast('Failed to load career roadmaps.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (slug) => {
    setSelectedSlug(slug);
    setLoadingDetail(true);
    setAssessResult(null);
    try {
      const res = await api.get(`/roadmaps/${slug}`);
      setDetail(res.data.roadmap);
    } catch {
      showToast('Unable to load roadmap details.', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const selectGoal = async (roadmapId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/roadmaps/${roadmapId}/select`);
      showToast(res.data.message, 'success');
      await loadList();
      if (detail) await loadDetail(detail.slug);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to set primary career goal.', 'error');
    }
  };

  const toggleStep = async (stepId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/roadmaps/steps/${stepId}/toggle`);
      setDetail((prev) => ({
        ...prev,
        studentProgress: {
          ...(prev.studentProgress || {}),
          completedStepIds: res.data.completedStepIds,
          progressPercent: res.data.progressPercent,
        },
      }));
      setRoadmaps((prev) =>
        prev.map((r) =>
          r.id === detail.id
            ? {
                ...r,
                studentProgress: {
                  ...(r.studentProgress || {}),
                  completedStepIds: res.data.completedStepIds,
                  progressPercent: res.data.progressPercent,
                },
              }
            : r
        )
      );
      if (res.data.xpAwarded > 0) {
        showToast(`Milestone completed! +${res.data.xpAwarded} XP awarded`, 'success');
      }
    } catch {
      showToast('Failed to update milestone progress.', 'error');
    }
  };

  const submitAssessment = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/roadmaps/${detail.id}/assess`, { answers: assessAnswers });
      setAssessResult(res.data);
      showToast(`Diagnostic complete: ${res.data.tier} (${res.data.percentage}%)`, 'success');
      loadList();
      loadDetail(detail.slug);
    } catch (err) {
      showToast(err.response?.data?.message || 'Assessment submission failed.', 'error');
    }
  };

  const filteredRoadmaps = roadmaps.filter(
    (r) => !difficultyFilter || r.difficulty === difficultyFilter
  );
  const completedSet = new Set((detail?.studentProgress?.completedStepIds || []).map(Number));

  return (
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <SectionHeading
            eyebrow="STRUCTURED CAREER TRACKS"
            title="Engineering & Technology Career Roadmaps"
            subtitle="Step-by-step skill paths linking recommended courses, hands-on capstone projects, skill diagnostics, and interview preparation."
          />
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white self-start md:self-auto"
          >
            <option value="">All Levels ({roadmaps.length} Tracks)</option>
            <option value="Beginner to Job-Ready">Beginner to Job-Ready</option>
            <option value="Beginner to Intermediate">Beginner to Intermediate</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Intermediate to Advanced">Intermediate to Advanced</option>
          </select>
        </div>

        {loading ? (
          <Loader label="Loading career roadmaps..." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Track Selector */}
            <div className="lg:col-span-4 space-y-3">
              {filteredRoadmaps.map((rm) => {
                const active = detail?.slug === rm.slug;
                const pct = rm.studentProgress?.progressPercent || 0;
                return (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={() => loadDetail(rm.slug)}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'bg-[#0A0F24] text-white border-[#0A0F24] shadow-md'
                        : 'bg-white text-slate-900 border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-mono text-[11px] ${active ? 'text-violet-300' : 'text-violet-700'}`}>
                        {rm.estimatedWeeks} WEEKS · {rm.stepsCount} STEPS
                      </span>
                      {rm.studentProgress?.isPrimary && (
                        <span className="font-mono text-[10px] font-bold text-emerald-400">ACTIVE GOAL</span>
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold mt-1">{rm.title}</h3>
                    <p className={`text-xs mt-1 line-clamp-2 ${active ? 'text-slate-300' : 'text-slate-600'}`}>
                      {rm.roleSummary}
                    </p>
                    {isAuthenticated && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${active ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums">{pct}%</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Interactive Roadmap Explorer */}
            <div className="lg:col-span-8">
              {loadingDetail || !detail ? (
                <Loader label="Loading roadmap curriculum..." />
              ) : (
                <div className="space-y-6">
                  <Card className="p-6 bg-[#0A0F24] text-white border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-2xl">
                        <p className="font-mono text-xs text-violet-300">
                          {detail.difficulty} · {detail.estimatedWeeks} WEEKS
                        </p>
                        <h2 className="font-display text-2xl font-bold mt-1">{detail.title}</h2>
                        <p className="text-sm text-slate-300 mt-2 leading-relaxed">{detail.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={detail.studentProgress?.isPrimary ? 'secondary' : 'primary'}
                          onClick={() => selectGoal(detail.id)}
                        >
                          <Target className="w-3.5 h-3.5" />
                          {detail.studentProgress?.isPrimary ? 'Active Career Goal' : 'Set as Career Goal'}
                        </Button>
                        {detail.assessmentQuestions?.length > 0 && (
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => {
                              setAssessAnswers({});
                              setAssessResult(null);
                              setAssessOpen(true);
                            }}
                          >
                            <HelpCircle className="w-3.5 h-3.5" /> Skill Assessment
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
                        {(detail.skillCategories || []).map((cat) => (
                          <span key={cat} className="font-mono">· {cat}</span>
                        ))}
                      </div>
                      {detail.studentProgress?.skillAssessmentResult && (
                        <span className="font-mono text-emerald-400">
                          Readiness: {detail.studentProgress.skillAssessmentResult} ({detail.studentProgress.skillAssessmentScore}%)
                        </span>
                      )}
                    </div>
                  </Card>

                  {/* Milestones Checklist */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Compass className="w-5 h-5 text-violet-600" /> Learning Milestones
                      </h3>
                      <span className="font-mono text-xs font-semibold text-violet-700 tabular-nums">
                        {detail.studentProgress?.progressPercent || 0}% Complete
                      </span>
                    </div>
                    <div className="space-y-3">
                      {(detail.steps || []).map((step) => {
                        const done = completedSet.has(step.id);
                        return (
                          <div
                            key={step.id}
                            className={`p-4 rounded-xl border transition-colors ${
                              done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => toggleStep(step.id)}
                                className="mt-0.5 text-slate-400 hover:text-violet-600 cursor-pointer shrink-0"
                                title={done ? 'Mark incomplete' : 'Mark milestone complete (+15 XP)'}
                              >
                                {done ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="font-mono text-[11px] text-violet-700">
                                  STEP {step.stepOrder} · {step.skillCategory} · {step.estimatedHours}H
                                </p>
                                <h4 className="font-display text-base font-bold text-slate-900 mt-0.5">{step.title}</h4>
                                <p className="text-sm text-slate-600 mt-1">{step.description}</p>
                                {step.projectTask && (
                                  <p className="text-xs text-slate-700 mt-2 font-medium">
                                    Practical Task: {step.projectTask}
                                  </p>
                                )}
                                {step.recommendedCourse && (
                                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <span className="text-xs text-slate-500">
                                      Recommended Course: <strong className="text-slate-800">{step.recommendedCourse.title}</strong>
                                    </span>
                                    <Link
                                      to={`/courses/${step.recommendedCourse.slug}`}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline shrink-0"
                                    >
                                      View Course <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Practical Projects & Interview Prep */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6">
                      <h3 className="font-display text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <FolderGit2 className="w-4 h-4 text-violet-600" /> Portfolio Practical Projects
                      </h3>
                      <ul className="space-y-2.5 text-sm text-slate-700">
                        {(detail.practicalProjects || []).map((proj, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="font-mono text-xs text-violet-700 mt-0.5">0{i + 1}</span>
                            <span>{proj}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>

                    <Card className="p-6">
                      <h3 className="font-display text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-violet-600" /> Interview Preparation Focus
                      </h3>
                      <ul className="space-y-2.5 text-sm text-slate-700">
                        {(detail.interviewPrep || []).map((topic, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="font-mono text-xs text-emerald-700 mt-0.5">✓</span>
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Diagnostic Skill Assessment Modal */}
      <Modal
        open={assessOpen}
        onClose={() => setAssessOpen(false)}
        title={`Skill Readiness Assessment · ${detail?.title || ''}`}
        maxWidth="max-w-xl"
      >
        {assessResult ? (
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-violet-50 border border-violet-200">
              <p className="font-mono text-xs text-violet-700">DIAGNOSTIC RESULT</p>
              <p className="font-display text-2xl font-bold text-slate-900 mt-1">
                {assessResult.tier} ({assessResult.percentage}%)
              </p>
              <p className="text-sm text-slate-700 mt-1">
                You answered {assessResult.score} out of {assessResult.total} readiness checkpoints correctly.
              </p>
            </div>
            <Button className="w-full" onClick={() => setAssessOpen(false)}>
              Continue on Roadmap
            </Button>
          </div>
        ) : (
          <form onSubmit={submitAssessment} className="space-y-5">
            {(detail?.assessmentQuestions || []).map((q) => (
              <div key={q.index} className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">
                  {q.index + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, oIdx) => (
                    <label
                      key={oIdx}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm cursor-pointer ${
                        assessAnswers[q.index] === oIdx
                          ? 'border-violet-600 bg-violet-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`assess-${q.index}`}
                        checked={assessAnswers[q.index] === oIdx}
                        onChange={() => setAssessAnswers((p) => ({ ...p, [q.index]: oIdx }))}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button type="submit" className="w-full">
              Evaluate My Readiness
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
