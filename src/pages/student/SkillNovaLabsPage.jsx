import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Box,
  Compass,
  Copy,
  Download,
  FileAudio,
  Gamepad2,
  Headphones,
  Lock,
  Mic,
  MicOff,
  Radio,
  Square,
  Upload,
  Volume2,
} from 'lucide-react';
import { Button, Card, SectionHeading } from '../../components/DesignSystem.jsx';
import LiveVoiceMentor from '../../components/LiveVoiceMentor.jsx';
import ThreeLabScene from '../../components/ThreeLabScene.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';

const TABS = [
  { id: '3d-lab', label: '3D Engineering Lab', icon: Box },
  { id: 'game', label: 'Circuit Runner 3D', icon: Gamepad2 },
  { id: 'live-voice', label: 'Live Voice Mentor', icon: Radio },
  { id: 'audio-studio', label: 'Study Audio & Podcast', icon: Headphones },
  { id: 'transcriber', label: 'Lecture Transcriber', icon: FileAudio },
  { id: 'campus-map', label: 'Campus & Hub Map', icon: Compass },
];

export default function SkillNovaLabsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('3d-lab');

  // Study Audio & Podcast TTS state
  const [ttsMode, setTtsMode] = useState('single'); // single | podcast
  const [ttsVoice, setTtsVoice] = useState('Kore');
  const [ttsStyle, setTtsStyle] = useState('Clear, encouraging engineering mentor');
  const [ttsScript, setTtsScript] = useState(
    'Today we break down how B-Tree indexes in PostgreSQL keep lookup latency logarithmic even across millions of student enrollment records.'
  );
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState('');
  const [generatedAudioModel, setGeneratedAudioModel] = useState('');

  // Transcriber state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [promptHint, setPromptHint] = useState('Software engineering lecture or mock interview');
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const switchTtsMode = (nextMode) => {
    setTtsMode(nextMode);
    if (nextMode === 'podcast') {
      setTtsScript(
        'Maya: Welcome back to SkillNova DevBrief! <breath> Today we are unpacking database connection pooling.\nArjun: That\'s right, |yeah| why does opening a new PostgreSQL connection per API request slow down under load?\nMaya: Great question — TLS handshakes and backend process forks add tens of milliseconds every time.'
      );
    } else {
      setTtsScript(
        'Today we break down how B-Tree indexes in PostgreSQL keep lookup latency logarithmic even across millions of student enrollment records.'
      );
    }
  };

  const handleGenerateAudio = async (e) => {
    e.preventDefault();
    if (!ttsScript.trim() || generatingAudio) return;
    setGeneratingAudio(true);
    setGeneratedAudioUrl('');

    try {
      const res = await api.post('/studio/tts', {
        mode: ttsMode,
        voiceName: ttsVoice,
        style: ttsStyle,
        text: ttsScript.trim(),
      });
      const dataUrl = `data:${res.data.mimeType || 'audio/wav'};base64,${res.data.audioBase64}`;
      setGeneratedAudioUrl(dataUrl);
      setGeneratedAudioModel(res.data.model || '');
      showToast('Study audio generated successfully!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to generate study audio.', 'error');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const uploadAudioForTranscription = async (blobOrFile, filename = 'recording.webm') => {
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', blobOrFile, filename);
      if (promptHint.trim()) fd.append('promptHint', promptHint.trim());
      const res = await api.post('/ai/transcribe', fd);
      setTranscript(res.data.transcript || '');
      showToast('Audio transcribed cleanly.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Audio transcription failed.', 'error');
    } finally {
      setTranscribing(false);
    }
  };

  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        uploadAudioForTranscription(blob, 'mic-note.webm');
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      showToast('Microphone access is required to record audio notes.', 'error');
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const renderAuthGate = (featureTitle) => (
    <Card className="p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[#0A0F24] text-violet-400 flex items-center justify-center mx-auto">
        <Lock className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900">
          Sign In to Access {featureTitle}
        </h3>
        <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
          {featureTitle} runs authenticated server-side Gemini sessions tied to your SKILLNOVA student account.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
        >
          Sign In to Continue <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
        >
          Create Free Account
        </Link>
      </div>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Engineering Sandbox"
          title="SKILLNOVA Interactive Labs & Studios"
          subtitle="Inspect 3D hardware assemblies, challenge Circuit Runner 3D for bonus XP, practice live voice interviews, generate study podcasts, and explore campuses."
        />
        <Link
          to="/game"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0A0F24] hover:bg-slate-800 rounded-lg shrink-0 self-start"
        >
          <Gamepad2 className="w-4 h-4 text-sky-400" /> Launch Circuit Runner 3D
        </Link>
      </div>

      {/* Horizontal Studio Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-violet-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: THREE.JS 3D ENGINEERING LAB */}
      {activeTab === '3d-lab' && (
        <div className="space-y-4">
          <ThreeLabScene />
          <p className="text-xs text-slate-500">
            Drag to orbit · Scroll to zoom · Use the bottom dock to inspect exploded assemblies, swap metallic/ceramic finishes, or press <kbd className="font-mono px-1.5 py-0.5 bg-slate-200 rounded">H</kbd> to hide controls.
          </p>
        </div>
      )}

      {/* TAB 2: CIRCUIT RUNNER 3D LAUNCHER */}
      {activeTab === 'game' && (
        <Card className="p-8 bg-[#0A0F24] text-white border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <p className="text-xs font-semibold text-sky-400">
              Gamified Learning Challenge
            </p>
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold">
              Circuit Runner 3D: Data-Bus Challenge
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Pilot the SKILLNOVA diagnostic rover across 3 progressive overclock stages. Collect blue logic nodes, trigger hyper-boosts with Spacebar, dodge crimson firewall blocks, and earn <strong>+25 XP per cleared stage</strong> directly into your SkillNova XP ledger.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">STAGE 1</span>
                <span className="text-white font-bold">Signal Grid (14 Nodes)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">STAGE 2</span>
                <span className="text-white font-bold">Core Bus (20 Nodes)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">STAGE 3</span>
                <span className="text-white font-bold">Overclock (26 Nodes)</span>
              </div>
            </div>
            <div className="pt-2">
              <Link
                to="/game"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-bold text-white"
              >
                <Gamepad2 className="w-5 h-5" /> Enter Fullscreen 3D Game <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 3: LIVE VOICE MENTOR */}
      {activeTab === 'live-voice' && (
        user ? <LiveVoiceMentor /> : renderAuthGate('Live Voice Mentor')
      )}

      {/* TAB 4: STUDY AUDIO & PODCAST STUDIO */}
      {activeTab === 'audio-studio' && (
        user ? (
          <Card className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-violet-700">
                  Audio Narration Studio
                </p>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                  Study Narration & Dual-Speaker Podcast Generator
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Convert lecture takeaways into crisp spoken audio or generate two-host dialogue revision podcasts as downloadable WAV files.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => switchTtsMode('single')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                    ttsMode === 'single' ? 'bg-[#0A0F24] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Single Narrator
                </button>
                <button
                  type="button"
                  onClick={() => switchTtsMode('podcast')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                    ttsMode === 'podcast' ? 'bg-[#0A0F24] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  2-Speaker Podcast
                </button>
              </div>
            </div>

            <form onSubmit={handleGenerateAudio} className="space-y-4">
              {ttsMode === 'single' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Voice</label>
                    <select
                      value={ttsVoice}
                      onChange={(e) => setTtsVoice(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Delivery Style</label>
                    <input
                      type="text"
                      value={ttsStyle}
                      onChange={(e) => setTtsStyle(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {ttsMode === 'podcast'
                    ? 'Dialogue Script (prefix lines with "Maya:" and "Arjun:", supports <breath>, <laugh>, |yeah|)'
                    : 'Lesson Summary or Study Script'}
                </label>
                <textarea
                  rows={5}
                  value={ttsScript}
                  onChange={(e) => setTtsScript(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-violet-600"
                />
              </div>

              <Button type="submit" loading={generatingAudio} disabled={!ttsScript.trim()}>
                <Volume2 className="w-4 h-4" /> Generate {ttsMode === 'podcast' ? 'Podcast Audio' : 'Study Narration'}
              </Button>
            </form>

            {generatedAudioUrl && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-violet-700">
                    Ready · {generatedAudioModel} (WAV 24kHz)
                  </span>
                  <a
                    href={generatedAudioUrl}
                    download={`skillnova-${ttsMode}-audio.wav`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Download WAV
                  </a>
                </div>
                <audio controls src={generatedAudioUrl} className="w-full" />
              </div>
            )}
          </Card>
        ) : (
          renderAuthGate('Study Audio & Podcast Studio')
        )
      )}

      {/* TAB 5: LECTURE AUDIO TRANSCRIBER */}
      {activeTab === 'transcriber' && (
        user ? (
          <Card className="p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-violet-700">
                Speech-to-Text Studio
              </p>
              <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                Lecture & Voice Note Transcriber
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Record directly from your microphone or upload an MP3, WAV, M4A, or WebM lecture clip for verbatim technical transcription.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Topic Context Hint (Optional)</label>
                <input
                  type="text"
                  value={promptHint}
                  onChange={(e) => setPromptHint(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {recording ? (
                  <Button variant="danger" onClick={stopMicRecording}>
                    <Square className="w-4 h-4" /> Stop & Transcribe
                  </Button>
                ) : (
                  <Button onClick={startMicRecording} disabled={transcribing}>
                    <Mic className="w-4 h-4" /> Record Mic Note
                  </Button>
                )}

                <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-4 h-4 text-violet-700" /> Upload Audio File
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    disabled={transcribing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAudioForTranscription(file, file.name);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {recording && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <MicOff className="w-4 h-4" /> Recording microphone audio… Click <strong>Stop & Transcribe</strong> when done.
              </div>
            )}

            {transcribing && (
              <p className="font-mono text-xs text-violet-700">Transcribing audio with Gemini…</p>
            )}

            {transcript && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Transcript Output</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(transcript);
                      showToast('Transcript copied to clipboard.', 'info');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Text
                  </button>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{transcript}</p>
              </div>
            )}
          </Card>
        ) : (
          renderAuthGate('Lecture Audio Transcriber')
        )
      )}

      {/* TAB 6: CAMPUS & TECH HUB MAP LAUNCHER */}
      {activeTab === 'campus-map' && (
        <Card className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <p className="text-xs font-semibold text-violet-700">
              Campus & Tech Hub Explorer
            </p>
            <h3 className="font-display text-2xl font-bold text-slate-900">
              Explore SKILLNOVA Campuses, Routes & Tech Hubs
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              View our 4 hybrid engineering centers across India, compute turn-by-turn routes via the Google Maps Routes API, and ask our Maps-Grounded explorer for verified transit stops and study spots.
            </p>
          </div>
          <Link
            to="/campus-map"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shrink-0"
          >
            <Compass className="w-4 h-4" /> Open Campus Map <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      )}
    </div>
  );
}
