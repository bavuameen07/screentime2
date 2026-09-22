"use client";

import { useState, useEffect, useRef } from "react";

interface Batch {
  id: number;
  label: string;
  startHour: number;
  endHour: number;
}

const BATCHES: Batch[] = [
  { id: 1, label: "Morning", startHour: 9, endHour: 12 },
  { id: 2, label: "Afternoon", startHour: 12, endHour: 15 },
  { id: 3, label: "Evening", startHour: 15, endHour: 18 },
  { id: 4, label: "Night", startHour: 18, endHour: 21 },
];

const AUDIO_CONTEXT = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playBeep() {
  if (!AUDIO_CONTEXT) return;
  
  const oscillator = AUDIO_CONTEXT.createOscillator();
  const gainNode = AUDIO_CONTEXT.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(AUDIO_CONTEXT.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = "sine";
  
  gainNode.gain.setValueAtTime(0.3, AUDIO_CONTEXT.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, AUDIO_CONTEXT.currentTime + 0.4);
  
  oscillator.start(AUDIO_CONTEXT.currentTime);
  oscillator.stop(AUDIO_CONTEXT.currentTime + 0.4);
}

function getCurrentBatchInfo(): { batch: Batch | null; remainingMs: number; isWaiting: boolean; nextBatchLabel: string } {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();
  const currentMs = now.getMilliseconds();
  
  const totalMsToday = ((currentHour * 60 + currentMinutes) * 60 + currentSeconds) * 1000 + currentMs;
  
  for (const batch of BATCHES) {
    const startMs = batch.startHour * 60 * 60 * 1000;
    const endMs = batch.endHour * 60 * 60 * 1000;
    
    if (totalMsToday >= startMs && totalMsToday < endMs) {
      return {
        batch,
        remainingMs: endMs - totalMsToday,
        isWaiting: false,
        nextBatchLabel: batch.id < 4 ? BATCHES[batch.id].label : "Tomorrow Morning",
      };
    }
  }
  
  if (currentHour < 9) {
    const startMs = 9 * 60 * 60 * 1000;
    return {
      batch: null,
      remainingMs: startMs - totalMsToday,
      isWaiting: true,
      nextBatchLabel: "Morning",
    };
  }
  
  const tomorrow9amMs = 24 * 60 * 60 * 1000 - totalMsToday + 9 * 60 * 60 * 1000;
  return {
    batch: null,
    remainingMs: tomorrow9amMs,
    isWaiting: true,
    nextBatchLabel: "Tomorrow Morning",
  };
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function ScreenTimeTracker() {
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [nextBatchLabel, setNextBatchLabel] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const prevBatchRef = useRef<number | null>(null);
  const audioInitialized = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      stored = null;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored ? stored === "dark" : prefersDark;
    setIsDark(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore write failures (private browsing, disabled storage)
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now);
      
      const info = getCurrentBatchInfo();
      setCurrentBatch(info.batch);
      setRemainingMs(info.remainingMs);
      setIsWaiting(info.isWaiting);
      setNextBatchLabel(info.nextBatchLabel);
      
      if (info.batch && prevBatchRef.current !== null && prevBatchRef.current !== info.batch.id) {
        if (audioInitialized.current) {
          playBeep();
        }
      }
      
      if (info.batch) {
        prevBatchRef.current = info.batch.id;
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const initAudio = async () => {
      if (AUDIO_CONTEXT && AUDIO_CONTEXT.state === "suspended") {
        await AUDIO_CONTEXT.resume();
      }
      audioInitialized.current = true;
    };
    
    const handleInteraction = () => {
      initAudio();
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
    
    document.addEventListener("click", handleInteraction);
    document.addEventListener("keydown", handleInteraction);
    
    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  return (
    <div className="min-h-screen classic-bg p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="w-full flex-1 flex flex-col">
        <div className="classic-frame rounded-lg p-px flex-1 flex flex-col transition-colors duration-500">
          <div className="bg-paper rounded-[calc(0.5rem-1px)] shadow-lg shadow-black/10 flex-1 flex flex-col overflow-hidden transition-colors duration-500">
            <div className="h-[3px] bg-navy transition-colors duration-500 shrink-0"></div>
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-8 sm:px-12 pt-8 sm:pt-10 pb-6 border-b border-line transition-colors duration-500 animate-fade-up"
              style={{ animationDelay: "0.05s" }}
            >
              <div className="flex items-baseline gap-4 text-left">
                <span className="text-xl sm:text-2xl font-serif text-heading transition-colors duration-500">
                  {mounted ? currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
                </span>
                <span className="text-base sm:text-lg text-muted font-mono">
                  {mounted ? currentTime.toLocaleTimeString() : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  className="px-4 py-2.5 rounded border border-navy-edge bg-paper text-heading text-sm font-semibold tracking-wide shadow-sm hover:bg-cream active:scale-95 transition-all"
                >
                  {isDark ? "Light" : "Dark"}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="px-5 py-2.5 rounded border border-navy-deep bg-navy text-ivory text-sm font-semibold tracking-wide shadow-sm hover:bg-navy-deep active:scale-95 transition-all"
                >
                  {isFullscreen ? "Normal Screen" : "Full Screen"}
                </button>
              </div>
            </div>

            <div className="text-center mb-8 px-8 animate-fade-up" style={{ animationDelay: "0.12s" }}>
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="h-px w-16 bg-gradient-to-r from-transparent to-line"></span>
                <span className="text-brass text-lg leading-none">◆</span>
                <span className="h-px w-16 bg-gradient-to-l from-transparent to-line"></span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-serif font-bold text-heading tracking-wide transition-colors duration-500">
                Your Remaining Time
              </h1>
              <p className="mt-3 text-brass text-xs font-semibold tracking-[0.3em] uppercase transition-colors duration-500">
                {mounted ? currentTime.toLocaleTimeString() : "--:--:--"}
              </p>
            </div>

            <div className="space-y-6 px-8 sm:px-12 pb-8 flex-1 flex flex-col">
              <div
                className={`rounded-md p-8 flex-1 flex flex-col justify-center relative overflow-hidden transition-all duration-500 border animate-fade-up ${isWaiting ? "bg-paper border-line" : "bg-navy border-navy-deep"}`}
                style={{ animationDelay: "0.18s" }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_45%)]"></div>
                <div className="relative flex items-center justify-between mb-4">
                  <span className={`text-xs font-semibold tracking-[0.25em] uppercase transition-colors duration-500 ${isWaiting ? "text-brass" : "text-brass-light"}`}>
                    {isWaiting ? "Waiting for" : "Current Batch"}
                  </span>
                  {!isWaiting && currentBatch && (
                    <span className="px-4 py-1.5 rounded border border-navy-edge bg-navy-deep text-ivory text-xs font-bold tracking-widest uppercase transition-colors duration-500">
                      Batch {currentBatch.id}
                    </span>
                  )}
                </div>
                
                <h2 className={`relative text-4xl sm:text-5xl font-serif font-bold tracking-wide transition-colors duration-500 ${isWaiting ? "text-ink" : "text-ivory"}`}>
                  {isWaiting ? `Next: ${nextBatchLabel}` : currentBatch?.label}
                </h2>
                
                {isWaiting && (
                  <p className="relative mt-3 text-muted transition-colors duration-500">
                    Starts at {isWaiting && currentTime.getHours() < 9 ? "9:00 AM" : "9:00 AM tomorrow"}
                  </p>
                )}
              </div>

              <div
                className="bg-cream rounded-md p-8 flex-1 flex flex-col justify-center text-center border border-line transition-colors duration-500 animate-fade-up"
                style={{ animationDelay: "0.24s" }}
              >
                <div className="text-xs font-semibold text-brass uppercase tracking-[0.3em] mb-3 transition-colors duration-500">
                  Time Remaining
                </div>
                <div
                  key={remainingMs}
                  className="font-mono text-6xl sm:text-7xl font-bold text-heading tabular-nums tracking-tight animate-tick"
                >
                  {formatMs(remainingMs)}
                </div>
                <div className="mt-3 text-sm text-muted tracking-wide transition-colors duration-500">
                  {isWaiting 
                    ? `Until ${nextBatchLabel} batch starts`
                    : `Until Batch ${(currentBatch?.id || 0) % 4 + 1} starts`}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
                {BATCHES.map((batch) => (
                  <div
                    key={batch.id}
                    className={`py-4 px-2 rounded text-center text-sm transition-all border ${
                      currentBatch?.id === batch.id
                        ? "bg-navy text-ivory border-navy-deep shadow-md shadow-navy/20 scale-105"
                        : "bg-paper text-muted border-line hover:border-navy-edge hover:text-heading"
                    }`}
                  >
                    <div className="font-bold">{batch.id}</div>
                    <div className="text-xs uppercase tracking-widest mt-1 opacity-90">{batch.label}</div>
                    <div className="text-xs opacity-70 mt-0.5 font-mono">
                      {batch.startHour}:00-{batch.endHour}:00
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="pt-5 border-t border-line mt-auto transition-colors duration-500 animate-fade-up"
                style={{ animationDelay: "0.36s" }}
              >
                <div className="flex items-center justify-center gap-3 text-xs text-muted tracking-widest uppercase">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4e8f63] dark:bg-[#6bb78a] animate-pulse"></span>
                    Live
                  </span>
                  <span className="text-brass/60">◆</span>
                  <span>Updates every second</span>
                  <span className="text-brass/60">◆</span>
                  <span>Beep at transitions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}