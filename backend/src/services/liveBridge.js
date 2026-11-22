import { WebSocketServer } from 'ws';
import { queryOne } from '../db/index.js';
import { verifyAccessToken } from '../utils/auth.js';
import { createLiveMentorSession } from './geminiService.js';

export function attachLiveMentorWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req, socket, head) => {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      if (parsedUrl.pathname !== '/ws/live-mentor') {
        return; // Leave other upgrade paths (e.g. Vite) untouched
      }

      const token = (parsedUrl.searchParams.get('token') || '').trim();
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const user = await queryOne(
        'SELECT id, full_name, role, is_active FROM users WHERE id = $1',
        [decoded.sub]
      );
      if (!user || !user.is_active) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const voice = parsedUrl.searchParams.get('voice') || 'Zephyr';
      const topic = (parsedUrl.searchParams.get('topic') || 'Software Engineering & Algorithms').slice(0, 120);

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.authContext = { user, voice, topic };
        wss.emit('connection', ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs) => {
    const { user, voice, topic } = clientWs.authContext || {};
    let liveSession = null;
    let closed = false;

    const closeAll = () => {
      if (closed) return;
      closed = true;
      try {
        liveSession?.close?.();
      } catch {
        // ignore close error
      }
      liveSession = null;
    };

    try {
      liveSession = await createLiveMentorSession({
        voiceName: voice,
        personaPrompt: `You are SKILLNOVA Live Voice Mentor coaching ${user?.fullName || 'a learner'} on ${topic}. Speak clearly, concisely, and interactively with practical examples and encouraging Socratic follow-ups.`,
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ ready: true, voice, topic }));
            }
          },
          onmessage: (message) => {
            if (clientWs.readyState !== 1) return;
            const content = message?.serverContent;
            if (!content) return;

            if (content.inputTranscription?.text) {
              clientWs.send(JSON.stringify({ inputTranscript: content.inputTranscription.text }));
            }
            if (content.outputTranscription?.text) {
              clientWs.send(JSON.stringify({ outputTranscript: content.outputTranscription.text }));
            }
            for (const part of content.modelTurn?.parts ?? []) {
              if (part?.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err) => {
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ error: err?.message || 'Live voice session encountered an error.' }));
            }
            closeAll();
          },
          onclose: () => {
            if (clientWs.readyState === 1) {
              clientWs.close();
            }
            closeAll();
          },
        },
      });
    } catch (err) {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify({ error: err?.message || 'Unable to connect to Gemini Live Voice service.' }));
        clientWs.close();
      }
      closeAll();
      return;
    }

    clientWs.on('message', (raw) => {
      if (!liveSession || closed) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.audio && typeof msg.audio === 'string') {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg?.text && typeof msg.text === 'string') {
          liveSession.sendRealtimeInput({ text: msg.text.slice(0, 1000) });
        }
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', closeAll);
    clientWs.on('error', closeAll);
  });

  return wss;
}
