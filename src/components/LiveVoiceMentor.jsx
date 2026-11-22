import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Radio, Send, Volume2 } from 'lucide-react';
import { Button, Card } from './DesignSystem.jsx';
import { getAccessToken } from '../services/api.js';

const VOICES = [
  { id: 'Zephyr', label: 'Zephyr (Warm & Clear)' },
  { id: 'Kore', label: 'Kore (Focused Instructor)' },
  { id: 'Puck', label: 'Puck (Upbeat Coach)' },
  { id: 'Charon', label: 'Charon (Deep & Calm)' },
  { id: 'Fenrir', label: 'Fenrir (Direct & Technical)' },
];

function float32ToBase64Pcm16(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export default function LiveVoiceMentor() {
  const [voice, setVoice] = useState('Zephyr');
  const [topic, setTopic] = useState('Data Structures, System Design & Mock Interview');
  const [status, setStatus] = useState('IDLE'); // IDLE | CONNECTING | LIVE | ERROR
  const [errorMsg, setErrorMsg] = useState('');
  const [textFollowup, setTextFollowup] = useState('');
  const [transcriptLog, setTranscriptLog] = useState([]);

  const wsRef = useRef(null);
  const inputCtxRef = useRef(null);
  const outputCtxRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef(new Set());
  const statusRef = useRef('IDLE');
  const intentionalStopRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const stopQueuedPlayback = () => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore already stopped
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const cleanupSession = () => {
    stopQueuedPlayback();
    try {
      processorRef.current?.disconnect();
    } catch {
      // ignore
    }
    processorRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current && inputCtxRef.current.state !== 'closed') {
      inputCtxRef.current.close().catch(() => {});
    }
    inputCtxRef.current = null;

    if (outputCtxRef.current && outputCtxRef.current.state !== 'closed') {
      outputCtxRef.current.close().catch(() => {});
    }
    outputCtxRef.current = null;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, []);

  const schedulePcmPlayback = (base64Audio) => {
    const ctx = outputCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const samples = base64Pcm16ToFloat32(base64Audio);
    if (samples.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.copyToChannel(samples, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.02, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  };

  const startLiveSession = async () => {
    if (status === 'CONNECTING' || status === 'LIVE') return;
    intentionalStopRef.current = false;
    setErrorMsg('');
    setStatus('CONNECTING');

    const token = getAccessToken();
    if (!token) {
      setStatus('ERROR');
      setErrorMsg('Please sign in first to establish an authenticated Live Voice Mentor session.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProto}//${window.location.host}/ws/live-mentor?token=${encodeURIComponent(token)}&voice=${encodeURIComponent(voice)}&topic=${encodeURIComponent(topic)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (event) => {
          if (wsRef.current?.readyState !== WebSocket.OPEN || statusRef.current !== 'LIVE') return;
          const floatSamples = event.inputBuffer.getChannelData(0);
          const base64Pcm = float32ToBase64Pcm16(floatSamples);
          wsRef.current.send(JSON.stringify({ audio: base64Pcm }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.ready) {
            setStatus('LIVE');
            setTranscriptLog((prev) => [
              ...prev,
              { id: Date.now(), speaker: 'SYSTEM', text: `Connected to ${msg.voice} Live Mentor (${msg.topic}). Speak whenever ready!` },
            ]);
          }
          if (msg.audio) {
            schedulePcmPlayback(msg.audio);
          }
          if (msg.interrupted) {
            stopQueuedPlayback();
          }
          if (msg.inputTranscript) {
            setTranscriptLog((prev) => [
              ...prev,
              { id: `${Date.now()}-u`, speaker: 'YOU', text: msg.inputTranscript },
            ]);
          }
          if (msg.outputTranscript) {
            setTranscriptLog((prev) => [
              ...prev,
              { id: `${Date.now()}-a`, speaker: 'MENTOR', text: msg.outputTranscript },
            ]);
          }
          if (msg.error) {
            setErrorMsg(msg.error);
            setStatus('ERROR');
            cleanupSession();
          }
        } catch {
          // ignore unparseable message
        }
      };

      ws.onerror = () => {
        if (!intentionalStopRef.current) {
          setErrorMsg('Live voice connection interrupted. Please retry in a moment.');
          setStatus('ERROR');
        }
        cleanupSession();
      };

      ws.onclose = () => {
        if (statusRef.current === 'LIVE' || statusRef.current === 'CONNECTING') {
          setStatus('IDLE');
        }
        cleanupSession();
      };
    } catch (err) {
      cleanupSession();
      setStatus('ERROR');
      setErrorMsg(err?.message || 'Microphone access was denied or unavailable.');
    }
  };

  const stopLiveSession = () => {
    intentionalStopRef.current = true;
    cleanupSession();
    setStatus('IDLE');
  };

  const sendTextNudge = (e) => {
    e.preventDefault();
    if (!textFollowup.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg = textFollowup.trim();
    wsRef.current.send(JSON.stringify({ text: msg }));
    setTranscriptLog((prev) => [...prev, { id: `${Date.now()}-t`, speaker: 'YOU', text: msg }]);
    setTextFollowup('');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-violet-700">
              Live Voice Mentor
            </p>
            <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
              Real-Time Bidirectional Engineering Coaching
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Practice mock interviews, talk through architectural trade-offs, and get immediate spoken feedback at 24kHz audio fidelity.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {status === 'LIVE' ? (
              <Button variant="danger" onClick={stopLiveSession}>
                <PhoneOff className="w-4 h-4" /> End Voice Session
              </Button>
            ) : (
              <Button onClick={startLiveSession} loading={status === 'CONNECTING'}>
                <Mic className="w-4 h-4" /> Start Voice Call
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mentor Voice Persona</label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              disabled={status === 'LIVE' || status === 'CONNECTING'}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-60"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Coaching Focus Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={status === 'LIVE' || status === 'CONNECTING'}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-900 text-slate-200 text-xs">
          <div className="flex items-center gap-2.5">
            {status === 'LIVE' ? (
              <Radio className="w-4 h-4 text-emerald-400" />
            ) : (
              <MicOff className="w-4 h-4 text-slate-400" />
            )}
            <span className="font-mono">
              Status:{' '}
              <strong className={status === 'LIVE' ? 'text-emerald-400' : 'text-slate-300'}>
                {status}
              </strong>
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" /> 16kHz Mic In · 24kHz Audio Out
          </span>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}
      </Card>

      {/* Live Transcript Feed */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-sm font-bold text-slate-900">Session Transcript</h4>
          {transcriptLog.length > 0 && (
            <button
              type="button"
              onClick={() => setTranscriptLog([])}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Clear Log
            </button>
          )}
        </div>

        <div className="min-h-[220px] max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
          {transcriptLog.length === 0 ? (
            <p className="text-xs text-slate-500 py-10 text-center">
              Click <strong>Start Voice Call</strong> above and allow microphone access to begin speaking with your SKILLNOVA AI Mentor.
            </p>
          ) : (
            transcriptLog.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  item.speaker === 'YOU'
                    ? 'bg-[#0A0F24] text-white ml-8'
                    : item.speaker === 'MENTOR'
                    ? 'bg-violet-50 border border-violet-200 text-slate-900 mr-8'
                    : 'bg-slate-100 text-slate-600 text-center font-mono'
                }`}
              >
                {item.speaker !== 'SYSTEM' && (
                  <span className="font-mono text-[10px] opacity-70 block mb-0.5">{item.speaker}</span>
                )}
                {item.text}
              </div>
            ))
          )}
        </div>

        {status === 'LIVE' && (
          <form onSubmit={sendTextNudge} className="flex gap-2 pt-2 border-t border-slate-200">
            <input
              type="text"
              value={textFollowup}
              onChange={(e) => setTextFollowup(e.target.value)}
              placeholder="Optionally type a code snippet or follow-up prompt mid-call..."
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-violet-600"
            />
            <Button type="submit" size="sm" disabled={!textFollowup.trim()}>
              <Send className="w-3.5 h-3.5" /> Send
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
