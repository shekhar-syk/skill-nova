import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Bot,
  ExternalLink,
  Globe,
  MessageSquarePlus,
  Mic,
  Send,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { Button, Card, Loader } from '../../components/DesignSystem.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { formatDate } from '../../utils/formatters.js';

const MODES = [
  { id: 'CONCEPT', label: 'Explain Concept', hint: 'Clear intuition, code walkthrough & mental models' },
  { id: 'DEBUG', label: 'Debug & Errors', hint: 'Paste a stack trace or bug for root-cause steps' },
  { id: 'ASSIGNMENT_HINT', label: 'Assignment Hints', hint: 'Guided scaffolding without spoiling the solution' },
  { id: 'INTERVIEW', label: 'Interview Prep', hint: 'Technical questions, follow-ups & ideal answers' },
  { id: 'MCQ', label: 'Practice MCQs', hint: '4-5 targeted MCQs with an answer key' },
  { id: 'SUMMARIZE', label: 'Summarize Lesson', hint: 'Structured cheat-sheet for any enrolled lesson' },
  { id: 'STUDY_PLAN', label: 'Study Plan', hint: 'Personalized roadmap & weekly schedule advice' },
];

const MODELS = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (Balanced & Search)' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Rapid Hints)' },
];

const THINKING_LEVELS = [
  { id: 'AUTO', label: 'Reasoning: Auto' },
  { id: 'LOW', label: 'Reasoning: Low (Fast)' },
  { id: 'MEDIUM', label: 'Reasoning: Medium' },
  { id: 'HIGH', label: 'Reasoning: High' },
  { id: 'XHIGH', label: 'Reasoning: Max (XHigh)' },
];

const LANGUAGES = ['General', 'Java', 'Python', 'SQL', 'HTML', 'CSS', 'JavaScript'];

const QUICK_PROMPTS = [
  { mode: 'CONCEPT', language: 'Java', text: 'Explain Java Streams vs Collections with a practical backend example.' },
  { mode: 'CONCEPT', language: 'SQL', text: 'When should I choose a composite B-tree index in PostgreSQL and how does column order affect queries?' },
  { mode: 'DEBUG', language: 'JavaScript', text: 'Why do I get "Cannot read properties of undefined (reading map)" in React async state updates and how do I prevent it?' },
  { mode: 'INTERVIEW', language: 'Python', text: 'Give me 5 mid-level Python & FastAPI interview questions with strong talking points.' },
  { mode: 'MCQ', language: 'HTML', text: 'Generate 4 practice MCQs on semantic HTML5 accessibility and CSS Grid layout.' },
];

export default function AIAssistantPage() {
  const { user, getDashboardPath } = useAuth();
  const { showToast } = useToast();
  const chatEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [loadingList, setLoadingList] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [mode, setMode] = useState('CONCEPT');
  const [language, setLanguage] = useState('General');
  const [model, setModel] = useState('gemini-4-hydrogen');
  const [thinkingLevel, setThinkingLevel] = useState('AUTO');
  const [useSearch, setUseSearch] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [apiError, setApiError] = useState('');

  // Optional enrolled course / lesson context
  const [enrollments, setEnrollments] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseLessons, setCourseLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');

  const loadInitial = async () => {
    setLoadingList(true);
    try {
      const [convRes, enrRes] = await Promise.all([
        api.get('/ai/conversations'),
        api.get('/enrollments/my'),
      ]);
      const list = convRes.data.conversations || [];
      setConversations(list);
      setEnrollments(enrRes.data.enrollments || []);
      if (list[0]) {
        await selectConversation(list[0].id);
      }
    } catch {
      showToast('Unable to load AI conversation history.', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (!selectedCourseId) {
      setCourseLessons([]);
      setSelectedLessonId('');
      return;
    }
    api
      .get(`/learning/courses/${selectedCourseId}`)
      .then((res) => {
        const flat = [];
        for (const m of res.data.modules || []) {
          for (const l of m.lessons || []) {
            flat.push({ id: l.id, title: `${m.title} — ${l.title}` });
          }
        }
        setCourseLessons(flat);
      })
      .catch(() => setCourseLessons([]));
  }, [selectedCourseId]);

  const selectConversation = async (id) => {
    try {
      const res = await api.get(`/ai/conversations/${id}`);
      setActiveConvId(id);
      setMessages(res.data.messages || []);
      if (res.data.conversation?.mode) setMode(res.data.conversation.mode);
      if (res.data.conversation?.language) setLanguage(res.data.conversation.language);
      setApiError('');
    } catch {
      showToast('Failed to load conversation messages.', 'error');
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setApiError('');
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/ai/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        startNewChat();
      }
      showToast('Conversation deleted.', 'info');
    } catch {
      showToast('Failed to delete conversation.', 'error');
    }
  };

  const toggleVoiceDictation = async () => {
    if (recording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'voice-question.webm');
          fd.append('promptHint', `${language} software engineering question`);
          const res = await api.post('/ai/transcribe', fd);
          if (res.data.transcript) {
            setPrompt((prev) => (prev ? `${prev} ${res.data.transcript}` : res.data.transcript));
          }
        } catch (err) {
          showToast(err.response?.data?.message || 'Voice transcription failed.', 'error');
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      showToast('Microphone access is needed for voice dictation.', 'error');
    }
  };

  const sendPrompt = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || sending) return;

    const text = prompt.trim();
    setSending(true);
    setApiError('');

    const optimisticUserMsg = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      mode,
      model_id: model,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setPrompt('');

    try {
      const res = await api.post('/ai/chat', {
        conversationId: activeConvId,
        prompt: text,
        mode,
        language,
        model,
        thinkingLevel: model === 'gemini-3.1-flash-lite' && thinkingLevel === 'XHIGH' ? 'HIGH' : thinkingLevel,
        useSearch,
        courseId: selectedCourseId ? Number(selectedCourseId) : null,
        lessonId: selectedLessonId ? Number(selectedLessonId) : null,
      });

      const { conversation, userMessage, assistantMessage } = res.data;
      setActiveConvId(conversation.id);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUserMsg.id),
        userMessage,
        assistantMessage,
      ]);

      const convListRes = await api.get('/ai/conversations');
      setConversations(convListRes.data.conversations || []);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      setPrompt(text);
      const errMsg =
        err.response?.data?.message ||
        'AI Learning Assistant is currently unavailable. Verify server Gemini configuration and retry.';
      setApiError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-[#0A0F24] text-white px-4 sm:px-6 h-16 flex items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to={getDashboardPath()}
            className="text-slate-300 hover:text-white flex items-center gap-1.5 text-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Portal
          </Link>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-5 h-5 text-violet-400 shrink-0" />
            <h1 className="font-display text-sm sm:text-base font-bold truncate">
              SKILLNOVA AI Learning Assistant
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/labs"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
          >
            Voice Mentor & Labs
          </Link>
          <span className="hidden md:inline font-mono text-xs text-slate-300">{user?.fullName}</span>
          <Button size="sm" variant="light" onClick={startNewChat}>
            <MessageSquarePlus className="w-3.5 h-3.5" /> New Chat
          </Button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conversation History Sidebar */}
        <aside className="lg:col-span-3 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-bold text-slate-900">Saved Conversations</h2>
              <span className="font-mono text-xs text-slate-500">{conversations.length}</span>
            </div>
            {loadingList ? (
              <Loader label="Loading history..." />
            ) : conversations.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                Start your first technical Q&A session. All chats are persisted in your SkillNova account.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={`group flex items-start justify-between gap-2 p-2.5 rounded-lg text-left cursor-pointer transition-colors ${
                      activeConvId === c.id
                        ? 'bg-violet-50 border border-violet-200'
                        : 'hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">{c.title}</p>
                      <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                        {c.mode} · {c.language} · {formatDate(c.updated_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(c.id, e)}
                      aria-label="Delete conversation"
                      className="text-slate-400 hover:text-rose-600 p-1 opacity-70 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <p className="font-display text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-violet-600" /> Optional Lesson Context
            </p>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Courses (General Context)</option>
              {enrollments.map((enr) => (
                <option key={enr.course_id} value={enr.course_id}>
                  {enr.title}
                </option>
              ))}
            </select>
            {courseLessons.length > 0 && (
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select specific lesson to summarize...</option>
                {courseLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            )}
          </Card>
        </aside>

        {/* Main Chat Interface */}
        <main className="lg:col-span-9 flex flex-col gap-4">
          {/* Controls Bar */}
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    title={m.hint}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      mode === m.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Programming language focus"
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    Topic: {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* Model, Thinking Depth & Search Grounding Bar */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  aria-label="Select Gemini model"
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={thinkingLevel}
                  onChange={(e) => setThinkingLevel(e.target.value)}
                  aria-label="Reasoning depth"
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                >
                  {THINKING_LEVELS.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      disabled={model === 'gemini-3.1-flash-lite' && t.id === 'XHIGH'}
                    >
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useSearch}
                  onChange={(e) => setUseSearch(e.target.checked)}
                  className="rounded accent-violet-600 cursor-pointer"
                />
                <Globe className="w-3.5 h-3.5 text-violet-600" />
                Live Web Search Grounding
              </label>
            </div>

            <p className="text-xs text-slate-500">
              {MODES.find((m) => m.id === mode)?.hint}
            </p>
          </Card>

          {apiError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI Request Error</p>
                <p className="text-xs mt-0.5 text-rose-800">{apiError}</p>
              </div>
            </div>
          )}

          {/* Chat Feed */}
          <Card className="flex-1 min-h-[420px] max-h-[560px] overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="py-8 max-w-2xl mx-auto text-center space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-[#0A0F24] text-violet-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Personalized AI Engineering Mentor
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Switch between Gemini models, enable live Google Search citations for current frameworks, or dictate questions with your microphone.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                  {QUICK_PROMPTS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setMode(q.mode);
                        setLanguage(q.language);
                        setPrompt(q.text);
                      }}
                      className="p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/40 text-xs text-slate-700 transition-colors cursor-pointer"
                    >
                      <span className="font-mono text-[10px] font-semibold text-violet-700 block mb-1">
                        {q.mode} · {q.language}
                      </span>
                      {q.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#0A0F24] text-white'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    <p className="font-mono text-[11px] opacity-75 mb-1">
                      {m.role === 'user' ? 'You' : 'SkillNova AI Tutor'} · {m.mode || mode}
                    </p>
                    <div>{m.content}</div>

                    {Array.isArray(m.groundingSources) && m.groundingSources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-600">
                          Web Sources ({m.groundingSources.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {m.groundingSources.map((src, sIdx) => (
                            <a
                              key={src.uri || sIdx}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 hover:text-violet-900 bg-white border border-slate-200 rounded-md px-2 py-1"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[220px]">{src.title || src.uri}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-600 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                  Generating response…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </Card>

          {/* Prompt Composer + Mic Dictation */}
          <Card className="p-4">
            <form onSubmit={sendPrompt} className="flex flex-col sm:flex-row gap-3">
              <textarea
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendPrompt();
                  }
                }}
                placeholder={
                  transcribing
                    ? 'Transcribing your voice prompt...'
                    : 'Ask a technical question, paste an error trace, or click the mic to dictate...'
                }
                className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-violet-600"
              />
              <div className="flex sm:flex-col justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={recording ? 'danger' : 'secondary'}
                  onClick={toggleVoiceDictation}
                  loading={transcribing}
                  title="Dictate prompt with microphone"
                >
                  {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {recording ? 'Stop' : 'Voice'}
                </Button>
                <Button type="submit" loading={sending} disabled={!prompt.trim()}>
                  <Send className="w-4 h-4" /> Send
                </Button>
              </div>
            </form>
          </Card>
        </main>
      </div>
    </div>
  );
}
