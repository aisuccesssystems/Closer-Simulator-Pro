'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
};

type ScoreData = {
  finalScore: number | null;
  clarity: number | null;
  conviction: number | null;
  empathy: number | null;
  closingPower: number | null;
  coachingFeedback: string | null;
};

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';
type Difficulty = 'rookie' | 'pro' | 'savage';

type SessionRecord = {
  id: string;
  date: string;
  scenario: string;
  difficulty: Difficulty;
  finalScore: number | null;
  clarity: number | null;
  conviction: number | null;
  empathy: number | null;
  closingPower: number | null;
};

const SCENARIOS: { name: string; emoji: string; description: string }[] = [
  { name: 'FSBO', emoji: '🏠', description: "They think they don't need you. Prove them wrong." },
  { name: 'Expired Listings', emoji: '🔥', description: "They're frustrated. You're their last shot." },
  { name: 'Cold Calling', emoji: '📞', description: 'Stranger on the phone. Turn them into a client.' },
  { name: 'Circle Prospecting', emoji: '🎯', description: "Their neighbor just sold. You've got intel." },
  { name: 'SOI Calls', emoji: '🤝', description: 'They know you. Now get them to trust you with the deal.' },
  { name: 'Lead Follow-Up', emoji: '⚡', description: 'They went cold. Warm them back up and close.' },
  { name: 'Recruiting', emoji: '💼', description: "They're loyal to someone else. Change their mind." },
];

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; emoji: string; description: string; color: string }> = {
  rookie: { label: 'ROOKIE', emoji: '🟢', description: 'Mildly resistant. Some easy wins.', color: '#22c55e' },
  pro: { label: 'PRO', emoji: '🟡', description: 'Realistic pushback. Firm but fair.', color: '#eab308' },
  savage: { label: 'SAVAGE', emoji: '🔴', description: 'Extremely skeptical. Combative. Earn every word.', color: '#FF1B1B' },
};

// ─── SCENARIO SCRIPTS ───
type ScriptSection = { title: string; color: string; items: string[] };
type ScenarioScript = { sections: ScriptSection[] };

const SCENARIO_SCRIPTS: Record<string, ScenarioScript> = {
  FSBO: {
    sections: [
      {
        title: '3 QUESTIONS TO ASK EVERY FSBO',
        color: '#FF1B1B',
        items: [
          'If I brought you a qualified buyer would you be willing to pay a 3% co-op?',
          'How long are you going to try and sell this home on your own... Before you decide to explore other options?',
          'In that time frame, if you do decide to explore other options... Do you have a close friend or family member that you would feel obligated to work with? Or will you be interviewing aggressive agents?',
        ],
      },
      {
        title: 'BRIDGE QUESTIONS',
        color: '#eab308',
        items: [
          'Why are you selling the property?',
          'How long has it been for sale?',
          'How did you come up with the price?',
          'What are you doing to market the property?',
          'Have you sold a home before?',
          'Are you getting any showings?',
          'What is the feedback of the showings?',
          'Do You Have Time For Everything?',
          'Are You Familiar With Financing?',
          'Do You Know How To Negotiate?',
          'Can You Sell Your Home Without Getting Emotional?',
          'Are You Always Available?',
          'Can You Show Buyers How Other Homes Compare?',
          'Do you know what your home is really worth?',
          'When you sell this home, where are you moving to?',
          'When do you have to be moved by?',
          'How did you determine your listing price?',
          'Why are you selling the property yourself?',
          'Did you consider using an agent?',
          'Did you get the letter I mailed you earlier this week?',
          'On a scale of 1-10, how important is it for you to sell this property?',
          'Is there anything you need, or I can help you with?',
        ],
      },
      {
        title: 'CLOSING STATEMENT — NO APPOINTMENT SET',
        color: '#22c55e',
        items: [
          "I appreciate your time today. I'll be sending you some information that'll be useful in helping you sell the property... Do you mind if I stay in contact?",
          'Great and all I ask is... if you do decide to explore other options... I want an opportunity to apply for the job of selling your home. Sound good?',
        ],
      },
      {
        title: 'QUALIFYING QUESTION — APPOINTMENT SET',
        color: '#3b82f6',
        items: [
          "Now, let me ask you something... when we meet... let's say you love everything that I have to say... you agree that my marketing plan will get the job done... You love my Easy Exit Listing Agreement... You see that I can get you top dollar for the property... is there any reason why I could not earn your business tomorrow at three thirty?",
        ],
      },
    ],
  },
};

const scoreInitial: ScoreData = {
  finalScore: null, clarity: null, conviction: null, empathy: null, closingPower: null, coachingFeedback: null,
};

function loadSessions(): SessionRecord[] {
  try {
    return JSON.parse(localStorage.getItem('csp_sessions') || '[]');
  } catch { return []; }
}

function saveSession(record: SessionRecord) {
  const sessions = loadSessions();
  sessions.unshift(record);
  localStorage.setItem('csp_sessions', JSON.stringify(sessions.slice(0, 20)));
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── ANIMATED SCORE NUMBER ───
function AnimatedScore({ value, delay = 0 }: { value: number; delay?: number }) {
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value * 10) / 10);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, value]);

  return <span className="score-appear">{started ? display.toFixed(1) : '0.0'}</span>;
}

// ─── ANIMATED METRIC BAR ───
function AnimatedBar({ label, value, delay }: { label: string; value: number | null; delay: number }) {
  const [show, setShow] = useState(false);
  const pct = value !== null ? Math.min(100, Math.max(0, (value / 10) * 100)) : 0;

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`space-y-1 transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex justify-between text-[13px]">
        <span className="text-[#999]">{label}</span>
        <span className="font-bold text-white">{show && value !== null ? `${value}/10` : ''}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#1a1a1a]">
        <div
          className={`h-full rounded-full bg-[#FF1B1B] ${show ? 'bar-animate' : ''}`}
          style={{ width: show ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [scenario, setScenario] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('pro');
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [scoreData, setScoreData] = useState<ScoreData>(scoreInitial);
  const [showScoreCard, setShowScoreCard] = useState(false);
  const [error, setError] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [autoListen, setAutoListen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [showScript, setShowScript] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const scenarioRef = useRef<string | null>(null);
  const autoListenRef = useRef(true);
  const difficultyRef = useRef<Difficulty>('pro');

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { autoListenRef.current = autoListen; }, [autoListen]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  useEffect(() => { setSessions(loadSessions()); }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── TTS ───
  const speakText = useCallback(async (text: string): Promise<void> => {
    setVoiceState('speaking');
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => { URL.revokeObjectURL(url); resolve(); }, 30000);
        audio.onended = () => { clearTimeout(timeout); URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(url); resolve(); };
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(() => {
            // Autoplay blocked (iOS Safari) — fall back to browser speech synthesis
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.rate = 1.0;
              utterance.onend = () => resolve();
              utterance.onerror = () => resolve();
              window.speechSynthesis.speak(utterance);
            } else {
              resolve();
            }
          });
        }
      });
    } catch (err) {
      console.error('TTS error:', err);
    }
    setVoiceState('idle');
  }, []);

  // ─── SEND + SPEAK ───
  const postChatAndSpeak = useCallback(async (userText: string, currentMessages: Message[], currentScenario: string) => {
    setVoiceState('processing');

    const userMsg: Message = { role: 'user', content: userText, timestamp: Date.now() };
    const updatedMessages = [...currentMessages, userMsg];
    setMessages(updatedMessages);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: currentScenario,
          messages: updatedMessages,
          difficulty: difficultyRef.current,
          scoreMode: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'API failed');

      const aiText = data.aiText || 'No response.';
      const aiMsg: Message = { role: 'assistant', content: aiText, timestamp: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);

      await speakText(aiText);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
      setVoiceState('idle');
    }
  }, [speakText]);

  // ─── SPEECH RECOGNITION ───
  const listeningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopListeningTimeout = useCallback(() => {
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    // Abort any existing recognition first
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    stopListeningTimeout();

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported. Use Chrome or Safari.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setVoiceState('listening');
      // Safety timeout — if listening hangs for 15s, force stop
      stopListeningTimeout();
      listeningTimeoutRef.current = setTimeout(() => {
        try { recognition.stop(); } catch {}
        setVoiceState('idle');
      }, 15000);
    };

    recognition.onresult = (event: any) => {
      stopListeningTimeout();
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript && scenarioRef.current) {
        postChatAndSpeak(transcript, messagesRef.current, scenarioRef.current);
      }
    };

    recognition.onerror = (event: any) => {
      stopListeningTimeout();
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Mic error: ${event.error}`);
      }
      setVoiceState('idle');
    };

    recognition.onend = () => {
      stopListeningTimeout();
      setVoiceState((prev) => prev === 'listening' ? 'idle' : prev);
    };

    try {
      recognition.start();
    } catch {
      setVoiceState('idle');
    }
  }, [postChatAndSpeak, stopListeningTimeout]);

  // ─── AUTO-LISTEN after speaking ───
  useEffect(() => {
    if (voiceState === 'idle' && autoListenRef.current && scenario && !showScoreCard && messages.length > 1) {
      const hasUserMessages = messages.some((m) => m.role === 'user');
      if (hasUserMessages) {
        const timer = setTimeout(() => {
          if (autoListenRef.current && scenarioRef.current && !showScoreCard) {
            startListening();
          }
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [voiceState, scenario, showScoreCard, messages, startListening]);

  // ─── AUTO-GREETING on scenario start ───
  const fetchGreeting = useCallback(async (scenarioName: string, diff: Difficulty) => {
    setVoiceState('processing');
    const systemMsg: Message = {
      role: 'system',
      content: `Scenario selected: ${scenarioName}. You are the prospect. Open the conversation naturally — answer the phone or door. The agent has not spoken yet. Be in character immediately.`,
      timestamp: Date.now(),
    };
    setMessages([systemMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenarioName,
          messages: [systemMsg],
          difficulty: diff,
          scoreMode: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'API failed');

      const aiText = data.aiText || 'Hello?';
      const aiMsg: Message = { role: 'assistant', content: aiText, timestamp: Date.now() };
      setMessages([systemMsg, aiMsg]);

      await speakText(aiText);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
      setVoiceState('idle');
    }
  }, [speakText]);

  // ─── END SESSION ───
  const endSession = useCallback(async () => {
    if (!scenario || voiceState === 'processing' || voiceState === 'speaking') return;

    if (recognitionRef.current) { recognitionRef.current.abort(); recognitionRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    setVoiceState('processing');
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, messages, difficulty, scoreMode: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'API failed');

      const score = data.parsed?.finalScore ?? null;
      const clarity = data.parsed?.clarity ?? null;
      const conviction = data.parsed?.conviction ?? null;
      const empathy = data.parsed?.empathy ?? null;
      const closingPower = data.parsed?.closingPower ?? null;

      setScoreData({
        finalScore: score, clarity, conviction, empathy, closingPower,
        coachingFeedback: data.parsed?.coachingFeedback || data.aiText,
      });

      // Save to localStorage
      saveSession({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        scenario,
        difficulty,
        finalScore: score, clarity, conviction, empathy, closingPower,
      });
      setSessions(loadSessions());

      setShowScoreCard(true);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setVoiceState('idle');
    }
  }, [scenario, messages, voiceState, difficulty]);

  // ─── START SESSION ───
  const startSession = (diff: Difficulty) => {
    if (!selectedScenario) return;
    setDifficulty(diff);
    setScenario(selectedScenario);
    setScoreData(scoreInitial);
    setShowScoreCard(false);
    setShowDifficultyModal(false);
    setError('');
    setVoiceState('idle');
    setSessionCount((c) => c + 1);
    // Greeting fires after state settles
    setTimeout(() => fetchGreeting(selectedScenario, diff), 100);
  };

  const runAgain = () => {
    if (!scenario) return;
    setScoreData(scoreInitial);
    setShowScoreCard(false);
    setError('');
    setVoiceState('idle');
    setSessionCount((c) => c + 1);
    fetchGreeting(scenario, difficulty);
  };

  const switchScenario = () => {
    if (recognitionRef.current) { recognitionRef.current.abort(); recognitionRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setScenario(null);
    setSelectedScenario(null);
    setMessages([]);
    setScoreData(scoreInitial);
    setShowScoreCard(false);
    setShowDifficultyModal(false);
    setError('');
    setVoiceState('idle');
  };

  // ─── Parse coaching feedback into 3 sections ───
  const parseCoaching = (text: string | null) => {
    if (!text) return { nailed: '', improve: '', action: '' };
    const lines = text.split('\n').filter(Boolean);
    let nailed = '', improve = '', action = '';
    let section = '';
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('nailed') || lower.includes('did well') || lower.includes('strength')) { section = 'nailed'; nailed += (nailed ? '\n' : '') + line; }
      else if (lower.includes('improve') || lower.includes('work on') || lower.includes('weakness')) { section = 'improve'; improve += (improve ? '\n' : '') + line; }
      else if (lower.includes('action') || lower.includes('step') || lower.includes('next time')) { section = 'action'; action += (action ? '\n' : '') + line; }
      else if (section === 'nailed') nailed += '\n' + line;
      else if (section === 'improve') improve += '\n' + line;
      else if (section === 'action') action += '\n' + line;
      else nailed += (nailed ? '\n' : '') + line;
    }
    return { nailed: nailed.trim(), improve: improve.trim(), action: action.trim() };
  };

  const micLabel = {
    idle: 'Tap to speak',
    listening: 'Listening...',
    processing: 'Prospect thinking...',
    speaking: 'Prospect speaking...',
  }[voiceState];

  // ═══════════════════════════════════════════════
  // ─── LOBBY SCREEN ───
  // ═══════════════════════════════════════════════
  if (!scenario) {
    return (
      <main className="min-h-screen">
        {/* Header */}
        <div className="text-center">
          <div style={{ background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #aaaaaa 75%, #333333 88%, #0a0a0a 100%)' }} className="px-4 pb-10 pt-4">
            <div className="mx-auto">
              <Image src="/logos/csp-logo-transparent.png" alt="Closer Simulator Pro" width={130} height={130} className="mx-auto" priority />
            </div>
          </div>
          <div className="px-4 pt-2">
            <p className="text-[14px] text-[#666]">
              Elite real estate roleplay coaching &bull; No fluff. Brutal love.
            </p>
            <div className="mx-auto mt-4 h-[2px] w-12 bg-[#FF1B1B]" />
          </div>
        </div>

        <div className="mx-auto max-w-[520px] px-4 pb-10">
          {/* Stats bar */}
          <div className="mb-6 grid grid-cols-4 gap-3">
            {[
              { value: 7, label: 'SCENARIOS' },
              { value: 4, label: 'SCORE METRICS' },
              { value: 10, label: 'MAX SCORE' },
              { value: sessionCount, label: 'SESSIONS' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-[#1f1f1f] bg-[#111] px-2 py-3 text-center">
                <div className="text-[18px] font-bold text-[#FF1B1B]">{stat.value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-[#555]">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* My Sessions button */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase text-[#FF1B1B]" style={{ letterSpacing: '0.2em' }}>
              CHOOSE YOUR BATTLE
            </p>
            <button
              onClick={() => { setSessions(loadSessions()); setShowHistory(!showHistory); }}
              className="text-[11px] font-bold uppercase text-[#555] transition hover:text-[#FF1B1B]"
            >
              {showHistory ? 'HIDE HISTORY' : 'MY SESSIONS'}
            </button>
          </div>

          {/* Session history panel */}
          {showHistory && (
            <div className="mb-4 rounded-lg border border-[#1f1f1f] bg-[#111] p-3">
              {sessions.length === 0 ? (
                <p className="text-center text-[12px] text-[#555]">No sessions yet. Start training!</p>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 10).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-[#0d0d0d] px-3 py-2">
                      <div>
                        <span className="text-[12px] font-bold text-white">{s.scenario}</span>
                        <span className="ml-2 text-[10px] uppercase text-[#555]">{s.difficulty}</span>
                        <div className="text-[10px] text-[#444]">{new Date(s.date).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[16px] font-bold text-[#FF1B1B]">{s.finalScore ?? '—'}</span>
                        <span className="text-[10px] text-[#555]">/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scenario grid */}
          <div className="grid grid-cols-2 gap-3">
            {SCENARIOS.map((s, idx) => {
              const isLast = idx === SCENARIOS.length - 1;
              const isSelected = selectedScenario === s.name;
              return (
                <button
                  key={s.name}
                  onClick={() => setSelectedScenario(isSelected ? null : s.name)}
                  className={`group flex items-center gap-3 rounded-[10px] border-l-[3px] border-[#FF1B1B] px-4 py-[18px] text-left transition-colors ${
                    isLast ? 'col-span-2' : ''
                  } ${
                    isSelected
                      ? 'border-r border-t border-b border-r-[#FF1B1B33] border-t-[#FF1B1B33] border-b-[#FF1B1B33] bg-[#1a0000]'
                      : 'border-r border-t border-b border-r-[#222] border-t-[#222] border-b-[#222] bg-[#111] hover:bg-[#1a0a0a]'
                  }`}
                >
                  <span className="text-[20px]">{s.emoji}</span>
                  <div className="flex-1">
                    <h3 className={`text-[14px] font-bold ${isSelected ? 'text-[#FF1B1B]' : 'text-white'}`}>{s.name}</h3>
                    <p className="mt-0.5 text-[12px] text-[#666]">{s.description}</p>
                  </div>
                  <span className={`text-[14px] transition-colors ${isSelected ? 'text-[#FF1B1B]' : 'text-[#333] group-hover:text-[#FF1B1B]'}`}>
                    ›
                  </span>
                </button>
              );
            })}
          </div>

          {selectedScenario && (
            <div className="mt-4 rounded-lg border border-[#FF1B1B33] bg-[#1a0000] px-4 py-3 text-center text-[13px] text-[#FF1B1B]">
              Ready to train: <span className="font-bold">{selectedScenario}</span>
            </div>
          )}

          <button
            onClick={() => { if (selectedScenario) setShowDifficultyModal(true); }}
            disabled={!selectedScenario}
            className={`mt-4 w-full rounded-lg py-3.5 text-[14px] font-bold uppercase tracking-wider transition-colors ${
              selectedScenario
                ? 'bg-[#FF1B1B] text-white hover:bg-[#e01717]'
                : 'bg-[#222] text-[#444] cursor-not-allowed'
            }`}
          >
            ENTER THE ARENA ›
          </button>
        </div>

        {/* Difficulty modal */}
        {showDifficultyModal && (
          <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowDifficultyModal(false)}>
            <div className="w-full max-w-[400px] rounded-xl border border-[#1f1f1f] bg-[#111] p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-1 text-center text-[18px] font-bold text-white">Select Difficulty</h3>
              <p className="mb-5 text-center text-[12px] text-[#555]">How tough should the prospect be?</p>
              <div className="space-y-3">
                {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG.rookie][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => startSession(key)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-[#222] bg-[#0d0d0d] px-4 py-4 text-left transition hover:border-[#FF1B1B33] hover:bg-[#1a0000]"
                  >
                    <span className="text-[24px]">{cfg.emoji}</span>
                    <div className="flex-1">
                      <h4 className="text-[14px] font-bold" style={{ color: cfg.color }}>{cfg.label}</h4>
                      <p className="text-[12px] text-[#666]">{cfg.description}</p>
                    </div>
                    <span className="text-[14px] text-[#333] group-hover:text-[#FF1B1B]">›</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowDifficultyModal(false)} className="mt-4 w-full text-center text-[12px] text-[#555] hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ═══════════════════════════════════════════════
  // ─── VOICE SESSION SCREEN ───
  // ═══════════════════════════════════════════════
  if (!showScoreCard) {
    const visibleMessages = messages.filter((m) => m.role !== 'system');

    return (
      <main className="flex min-h-screen flex-col px-4 py-6">
        <section className="mx-auto flex w-full max-w-[600px] flex-1 flex-col">
          {/* Header bar */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#FF1B1B]" style={{ letterSpacing: '0.2em' }}>SCENARIO</p>
              <h2 className="text-[20px] font-bold text-white">
                {scenario}
                <span className="ml-2 text-[11px] font-normal uppercase" style={{ color: DIFFICULTY_CONFIG[difficulty].color }}>
                  {DIFFICULTY_CONFIG[difficulty].label}
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Auto-listen toggle */}
              <button
                onClick={() => setAutoListen(!autoListen)}
                className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                  autoListen ? 'bg-[#FF1B1B22] text-[#FF1B1B]' : 'bg-[#222] text-[#555]'
                }`}
              >
                Auto {autoListen ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={switchScenario}
                className="rounded-lg border border-[#333] bg-[#111] px-3 py-2 text-[12px] font-bold text-[#999] transition hover:border-[#FF1B1B] hover:text-white"
              >
                Exit
              </button>
            </div>
          </div>

          {/* Mic area */}
          <div className="flex flex-col items-center py-6">
            {/* Wave bars above mic (listening state) */}
            <div className="mb-3 flex h-[24px] items-end">
              {voiceState === 'listening' && (
                <>
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                </>
              )}
            </div>

            <button
              onClick={() => voiceState === 'idle' && startListening()}
              disabled={voiceState !== 'idle'}
              className={`relative flex h-[80px] w-[80px] items-center justify-center rounded-full transition-all ${
                voiceState === 'listening'
                  ? 'mic-pulse bg-[#FF1B1B] text-white'
                  : voiceState === 'idle'
                    ? 'bg-[#FF1B1B] text-white hover:brightness-110 active:scale-95'
                    : voiceState === 'speaking'
                      ? 'bg-[#1a0000] text-[#FF1B1B] border-2 border-[#FF1B1B]'
                      : 'bg-[#222] text-[#666] cursor-not-allowed'
              }`}
            >
              {voiceState === 'processing' ? (
                <div className="spinner" />
              ) : voiceState === 'speaking' ? (
                <div className="flex items-center gap-1">
                  <div className="speaker-wave h-3 w-1 rounded-full bg-[#FF1B1B]" />
                  <div className="speaker-wave h-5 w-1 rounded-full bg-[#FF1B1B]" />
                  <div className="speaker-wave h-4 w-1 rounded-full bg-[#FF1B1B]" />
                </div>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="1" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                </svg>
              )}
            </button>

            <p className={`mt-3 text-[13px] font-medium ${
              voiceState === 'listening' ? 'text-[#FF1B1B]'
              : voiceState === 'speaking' ? 'text-[#FF1B1B]'
              : 'text-[#666]'
            }`}>
              {micLabel}
            </p>
          </div>

          {/* iMessage-style transcript */}
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto space-y-3 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] p-4"
            style={{ maxHeight: '340px', minHeight: '140px' }}
          >
            {visibleMessages.length === 0 && (
              <p className="text-center text-[13px] text-[#444]">Waiting for prospect to pick up...</p>
            )}
            {visibleMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div key={`${idx}-${msg.role}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isUser
                      ? 'bg-white text-black rounded-br-md'
                      : 'border border-[#FF1B1B22] bg-[#1a0000] text-[#ffcccc] rounded-bl-md'
                  }`}>
                    <div className={`mb-1 text-[9px] font-bold uppercase tracking-wider ${isUser ? 'text-[#999]' : 'text-[#FF1B1B66]'}`}>
                      {isUser ? 'YOU' : 'PROSPECT'}
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                    {msg.timestamp && (
                      <div className={`mt-1 text-[9px] ${isUser ? 'text-[#bbb] text-right' : 'text-[#FF1B1B44]'}`}>
                        {formatTime(msg.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Script Reference Panel */}
          {scenario && SCENARIO_SCRIPTS[scenario] && (
            <div className="mt-3">
              <button
                onClick={() => setShowScript(!showScript)}
                className="flex w-full items-center justify-between rounded-lg border border-[#1f1f1f] bg-[#111] px-4 py-3 transition hover:border-[#FF1B1B33]"
              >
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF1B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#FF1B1B]">
                    Script Reference
                  </span>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showScript ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showScript && (
                <div className="mt-2 max-h-[400px] overflow-y-auto rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 space-y-5">
                  {SCENARIO_SCRIPTS[scenario].sections.map((section) => (
                    <div key={section.title}>
                      <div
                        className="mb-3 flex items-center gap-2 border-b pb-2"
                        style={{ borderColor: `${section.color}33` }}
                      >
                        <div className="h-2 w-2 rounded-full" style={{ background: section.color }} />
                        <h4 className="text-[11px] font-black uppercase tracking-widest" style={{ color: section.color }}>
                          {section.title}
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {section.items.map((item, i) => (
                          <div key={i} className="flex gap-3 rounded-lg bg-[#111] px-3 py-2.5 border border-[#1a1a1a]">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: `${section.color}22`, color: section.color }}>
                              {i + 1}
                            </span>
                            <p className="text-[12px] leading-relaxed text-[#ccc]">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* End session */}
          <button
            onClick={endSession}
            disabled={voiceState === 'processing' || voiceState === 'speaking' || visibleMessages.length === 0}
            className="mt-4 w-full rounded-lg bg-[#FF1B1B] py-3.5 text-[14px] font-bold uppercase tracking-wider text-white transition hover:bg-[#e01717] disabled:bg-[#222] disabled:text-[#444]"
          >
            END SESSION & GET SCORE
          </button>

          {error && <p className="mt-3 text-center text-[12px] text-[#FF1B1B]">{error}</p>}
        </section>
      </main>
    );
  }

  // ═══════════════════════════════════════════════
  // ─── ELITE SCORECARD SCREEN ───
  // ═══════════════════════════════════════════════
  const coaching = parseCoaching(scoreData.coachingFeedback);

  return (
    <main className="min-h-screen px-4 py-8">
      <section className="mx-auto max-w-[520px]">
        {/* Big score */}
        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#555]" style={{ letterSpacing: '0.2em' }}>
            YOUR SCORE
          </p>
          <div className="mt-2 text-[72px] font-black leading-none text-[#FF1B1B]">
            {scoreData.finalScore !== null ? (
              <AnimatedScore value={scoreData.finalScore} />
            ) : '—'}
          </div>
          <p className="mt-1 text-[14px] text-[#555]">out of 10</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-[12px] text-[#666]">{scenario}</span>
            <span className="text-[10px] uppercase" style={{ color: DIFFICULTY_CONFIG[difficulty].color }}>
              {DIFFICULTY_CONFIG[difficulty].label}
            </span>
          </div>
        </div>

        {/* Metric bars */}
        <div className="mb-8 rounded-xl border border-[#1f1f1f] bg-[#111] p-5 space-y-5">
          <AnimatedBar label="Clarity" value={scoreData.clarity} delay={300} />
          <AnimatedBar label="Conviction" value={scoreData.conviction} delay={600} />
          <AnimatedBar label="Empathy" value={scoreData.empathy} delay={900} />
          <AnimatedBar label="Closing Power" value={scoreData.closingPower} delay={1200} />
        </div>

        {/* Coaching cards */}
        <div className="space-y-3">
          {coaching.nailed && (
            <div className="fade-in-up rounded-lg border-l-[3px] border-[#22c55e] bg-[#111] p-4" style={{ animationDelay: '1.5s' }}>
              <div className="mb-1 text-[11px] font-bold uppercase text-[#22c55e]">What You Nailed</div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#ccc]">{coaching.nailed}</p>
            </div>
          )}
          {coaching.improve && (
            <div className="fade-in-up rounded-lg border-l-[3px] border-[#FF1B1B] bg-[#111] p-4" style={{ animationDelay: '1.8s' }}>
              <div className="mb-1 text-[11px] font-bold uppercase text-[#FF1B1B]">Must Improve</div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#ccc]">{coaching.improve}</p>
            </div>
          )}
          {coaching.action && (
            <div className="fade-in-up rounded-lg border-l-[3px] border-[#eab308] bg-[#111] p-4" style={{ animationDelay: '2.1s' }}>
              <div className="mb-1 text-[11px] font-bold uppercase text-[#eab308]">Action Step</div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#ccc]">{coaching.action}</p>
            </div>
          )}
          {/* Fallback if parsing didn't split cleanly */}
          {!coaching.nailed && !coaching.improve && !coaching.action && scoreData.coachingFeedback && (
            <div className="fade-in-up rounded-lg border border-[#1f1f1f] bg-[#111] p-4" style={{ animationDelay: '1.5s' }}>
              <div className="mb-1 text-[11px] font-bold uppercase text-[#FF1B1B]">Coaching Feedback</div>
              <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#ccc]">{scoreData.coachingFeedback}</pre>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={runAgain}
            className="flex-1 rounded-lg border border-[#333] bg-[#111] py-3 text-[13px] font-bold uppercase text-white transition hover:border-[#FF1B1B]"
          >
            Run Again
          </button>
          <button
            onClick={switchScenario}
            className="flex-1 rounded-lg bg-[#FF1B1B] py-3 text-[13px] font-bold uppercase text-white transition hover:bg-[#e01717]"
          >
            New Scenario
          </button>
        </div>
      </section>
    </main>
  );
}
