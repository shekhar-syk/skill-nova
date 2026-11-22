import { GoogleGenAI, Modality, ThinkingLevel } from '@google/genai';
import { config } from '../config/env.js';

export const ALLOWED_TUTOR_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
const DEFAULT_TUTOR_MODEL = 'gemini-4-hydrogen';

let cachedClient = null;
export function getGeminiClient() {
  const apiKey = (config.gemini.apiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error('AI service is unavailable: GEMINI_API_KEY is not configured on the server.');
    err.statusCode = 503;
    err.exposeMessage = true;
    throw err;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

function normalizeGeminiError(err, fallbackMsg = 'Failed to get response from Gemini AI service.') {
  if (err?.statusCode) return err;
  let cleanMsg = err?.message || fallbackMsg;
  let status = err?.status === 429 ? 429 : err?.status === 503 ? 503 : 502;
  try {
    const parsed = JSON.parse(cleanMsg);
    if (parsed?.error?.message) cleanMsg = parsed.error.message;
    if (parsed?.error?.code === 503) status = 503;
    if (parsed?.error?.code === 429) status = 429;
  } catch {
    // keep cleanMsg as-is
  }
  const apiErr = new Error(cleanMsg);
  apiErr.statusCode = status;
  apiErr.exposeMessage = true;
  return apiErr;
}

const MODE_INSTRUCTIONS = {
  CONCEPT:
    'Explain programming and engineering concepts clearly with concise mental models, clean syntax examples, common pitfalls, and practical industry context.',
  DEBUG:
    'Analyze the error message or buggy snippet step-by-step: identify root cause, explain why it occurs, and show the exact corrected fix with verification steps.',
  ASSIGNMENT_HINT:
    'Act as a mentor: guide the student with structured hints, edge cases to consider, and architectural checkpoints WITHOUT handing over a copy-paste full graded solution.',
  INTERVIEW:
    'Generate realistic technical interview questions (conceptual + coding/system design) with expected answer rubrics and follow-up probes.',
  MCQ:
    'Generate well-crafted multiple-choice practice questions (4 options each) along with the correct option and concise explanation for each.',
  SUMMARIZE:
    'Summarize the provided course lesson or topic into crisp key takeaways, core terminology, and actionable study checklist items.',
  STUDY_PLAN:
    'Create a personalized, realistic study plan grounded in the student context (current enrollments, progress %, quiz scores, and career goals).',
};

const THINKING_MAP = {
  LOW: ThinkingLevel.LOW,
  MEDIUM: ThinkingLevel.MEDIUM,
  HIGH: ThinkingLevel.HIGH,
  XHIGH: ThinkingLevel.XHIGH,
  MINIMAL: ThinkingLevel.MINIMAL,
};

function extractSearchSources(response) {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    if (chunk?.web?.uri && !seen.has(chunk.web.uri)) {
      seen.add(chunk.web.uri);
      sources.push({
        type: 'web',
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri,
      });
    }
  }
  return sources;
}

function extractMapsSources(response) {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    if (chunk?.maps?.uri && !seen.has(chunk.maps.uri)) {
      seen.add(chunk.maps.uri);
      const reviewSnippets = (chunk.maps.placeAnswerSources?.reviewSnippets || [])
        .map((s) => ({
          uri: s?.uri || '',
          reviewId: s?.reviewId || '',
          authorName: s?.authorAttribution?.displayName || '',
        }))
        .filter((s) => s.uri || s.authorName);

      sources.push({
        type: 'maps',
        title: chunk.maps.title || 'View Place on Google Maps',
        uri: chunk.maps.uri,
        placeId: chunk.maps.placeId || '',
        reviewSnippets,
      });
    }
  }
  return sources;
}

export async function generateTutorReply({
  prompt,
  mode = 'CONCEPT',
  language = 'General',
  model = DEFAULT_TUTOR_MODEL,
  thinkingLevel = 'AUTO',
  useSearch = false,
  history = [],
  studentContext = null,
  lessonContext = null,
}) {
  const ai = getGeminiClient();
  const selectedModel = ALLOWED_TUTOR_MODELS.includes(model) ? model : DEFAULT_TUTOR_MODEL;

  const contextLines = [
    'You are the SKILLNOVA AI Learning Assistant, an expert technical mentor across Java, Python, SQL, HTML, CSS, JavaScript, Cloud, DevOps, and AI/ML.',
    `Selected Mode: ${mode} — ${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.CONCEPT}`,
    `Language / Domain Focus: ${language}`,
    'Keep explanations accurate, structured with clear markdown headings/bullets/code blocks, and encouraging.',
  ];

  if (studentContext) {
    contextLines.push(`Student Context: ${JSON.stringify(studentContext)}`);
  }
  if (lessonContext) {
    contextLines.push(
      `Current Course/Lesson Context: Course="${lessonContext.courseTitle}", Lesson="${lessonContext.lessonTitle}". Excerpt: ${String(lessonContext.content || '').slice(0, 1200)}`
    );
  }

  const transcript = history
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = transcript
    ? `Previous Conversation:\n${transcript}\n\nStudent: ${prompt}`
    : `Student: ${prompt}`;

  const reqConfig = {
    systemInstruction: contextLines.join('\n'),
  };

  if (useSearch) {
    reqConfig.tools = [{ googleSearch: {} }];
  }

  if (thinkingLevel && thinkingLevel !== 'AUTO' && THINKING_MAP[thinkingLevel]) {
    const level = THINKING_MAP[thinkingLevel];
    if (selectedModel === 'gemini-4-hydrogen' && level !== ThinkingLevel.MINIMAL) {
      reqConfig.thinkingConfig = { thinkingLevel: level };
    } else if (selectedModel === 'gemini-3.1-flash-lite' && level !== ThinkingLevel.XHIGH) {
      reqConfig.thinkingConfig = { thinkingLevel: level };
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: fullPrompt,
      config: reqConfig,
    });

    const text = response?.text;
    if (!text || !text.trim()) {
      const err = new Error('AI service returned an empty response. Please try rephrasing your question.');
      err.statusCode = 502;
      err.exposeMessage = true;
      throw err;
    }

    const sources = useSearch ? extractSearchSources(response) : [];

    return {
      text: text.trim(),
      model: selectedModel,
      sources,
      tokensUsed: Number(response?.usageMetadata?.totalTokenCount || 0),
    };
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

export async function generateMapsGroundedReply({ prompt, lat = null, lng = null }) {
  const ai = getGeminiClient();

  const reqConfig = {
    tools: [{ googleMaps: {} }],
  };

  const numLat = typeof lat === 'number' ? lat : Number(lat);
  const numLng = typeof lng === 'number' ? lng : Number(lng);
  if (Number.isFinite(numLat) && Number.isFinite(numLng) && lat !== null && lng !== null) {
    reqConfig.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: numLat,
          longitude: numLng,
        },
      },
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: reqConfig,
    });

    const text = response?.text?.trim();
    if (!text) {
      const err = new Error('Location assistant returned an empty response. Please refine your query.');
      err.statusCode = 502;
      err.exposeMessage = true;
      throw err;
    }

    return {
      text,
      model: 'gemini-4-hydrogen',
      sources: extractMapsSources(response),
    };
  } catch (err) {
    throw normalizeGeminiError(err, 'Failed to query Google Maps Grounding service.');
  }
}

export async function transcribeAudioBuffer({ buffer, mimeType = 'audio/webm', promptHint = '' }) {
  const ai = getGeminiClient();
  const safeMime = mimeType && mimeType.startsWith('audio/') ? mimeType : 'audio/webm';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: safeMime,
              data: buffer.toString('base64'),
            },
          },
          {
            text: promptHint
              ? `Transcribe this audio accurately. Context hint: ${promptHint}`
              : 'Transcribe this audio accurately.',
          },
        ],
      },
    });

    const transcript = response?.text?.trim() || '';
    if (!transcript) {
      const err = new Error('No clear speech could be transcribed from the provided audio.');
      err.statusCode = 422;
      err.exposeMessage = true;
      throw err;
    }

    return {
      transcript,
      model: 'gemini-3.5-transcribe',
    };
  } catch (err) {
    throw normalizeGeminiError(err, 'Failed to transcribe audio with Gemini.');
  }
}

const VALID_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export async function generateStudyAudio({
  text,
  mode = 'single',
  voiceName = 'Kore',
  style = 'Clear, articulate university engineering instructor',
  speakerA = { name: 'Maya', voice: 'Kore', style: 'Warm, articulate engineering host' },
  speakerB = { name: 'Arjun', voice: 'Puck', style: 'Curious, enthusiastic learner' },
}) {
  const ai = getGeminiClient();
  const safeVoice = VALID_VOICES.includes(voiceName) ? voiceName : 'Kore';

  try {
    if (mode === 'podcast') {
      const nameA = (speakerA?.name || 'Maya').trim().slice(0, 32) || 'Maya';
      const nameB = (speakerB?.name || 'Arjun').trim().slice(0, 32) || 'Arjun';
      const voiceA = VALID_VOICES.includes(speakerA?.voice) ? speakerA.voice : 'Kore';
      const voiceB = VALID_VOICES.includes(speakerB?.voice) ? speakerB.voice : 'Puck';

      const lines = String(text || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const parts = lines.slice(0, 12).map((line, idx) => {
        const isB = line.toLowerCase().startsWith(`${nameB.toLowerCase()}:`) || (!line.toLowerCase().startsWith(`${nameA.toLowerCase()}:`) && idx % 2 === 1);
        const speaker = isB ? nameB : nameA;
        const speakerStyle = isB ? speakerB?.style || 'Curious engineering student' : speakerA?.style || 'Warm technical mentor';
        const formatted = line.includes(':') ? line : `${speaker}: ${line}`;
        return {
          text: formatted,
          speechMetadata: {
            speaker,
            style: speakerStyle,
          },
        };
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: nameA, voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceA } } },
                { speaker: nameB, voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceB } } },
              ],
            },
          },
        },
      });

      const base64Audio = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        const err = new Error('Podcast speech generation returned empty audio.');
        err.statusCode = 502;
        err.exposeMessage = true;
        throw err;
      }

      return {
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        model: 'gemini-3.8-flash-tts',
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              ...(style ? { speechMetadata: { style } } : {}),
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: safeVoice },
          },
        },
      },
    });

    const base64Audio = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      const err = new Error('Speech generation returned empty audio.');
      err.statusCode = 502;
      err.exposeMessage = true;
      throw err;
    }

    return {
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      model: 'gemini-3.8-flash-lite-tts',
    };
  } catch (err) {
    throw normalizeGeminiError(err, 'Failed to generate study audio.');
  }
}

export async function createLiveMentorSession({
  voiceName = 'Zephyr',
  personaPrompt = 'You are an encouraging SKILLNOVA live engineering mentor helping students master software architecture, algorithms, and debugging in concise spoken turns.',
  callbacks,
}) {
  const ai = getGeminiClient();
  const safeVoice = VALID_VOICES.includes(voiceName) ? voiceName : 'Zephyr';

  return ai.live.connect({
    model: 'gemini-3.8-live',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: safeVoice },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: personaPrompt,
    },
    callbacks,
  });
}
