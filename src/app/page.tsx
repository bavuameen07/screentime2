"use client";

import { useState, useEffect, useRef } from "react";

interface Batch {
  id: number;
  label: string;
  startHour: number;
  endHour: number;
  color: string;
}

const BATCHES: Batch[] = [
  { id: 1, label: "Morning", startHour: 9, endHour: 12, color: "bg-yellow-400" },
  { id: 2, label: "Afternoon", startHour: 12, endHour: 15, color: "bg-yellow-500" },
  { id: 3, label: "Evening", startHour: 15, endHour: 18, color: "bg-yellow-600" },
  { id: 4, label: "Night", startHour: 18, endHour: 21, color: "bg-yellow-300" },
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
  const prevBatchRef = useRef<number | null>(null);
  const audioInitialized = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="min-h-screen premium-bg p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="w-full flex-1 flex flex-col">
        <div className="gold-border rounded-3xl p-px flex-1 flex flex-col">
          <div className="bg-gradient-to-b from-neutral-900 to-black rounded-[calc(1.5rem-1px)] shadow-2xl shadow-yellow-900/20 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-8 sm:px-12 pt-8 sm:pt-10 pb-6">
              <div className="flex items-baseline gap-4 text-left">
                <span className="text-xl sm:text-2xl font-semibold text-yellow-100/90 tracking-wide">
                  {mounted ? currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
                </span>
                <span className="text-lg sm:text-xl text-yellow-400/80 font-mono tracking-widest">
                  {mounted ? currentTime.toLocaleTimeString() : ""}
                </span>
              </div>
              <button
                onClick={toggleFullscreen}
                className="px-5 py-2.5 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 text-black text-sm font-bold tracking-wide shadow-lg shadow-yellow-500/20 hover:shadow-yellow-400/40 hover:from-yellow-200 hover:to-yellow-500 active:scale-95 transition-all"
              >
                {isFullscreen ? "Normal Screen" : "Full Screen"}
              </button>
            </div>

            <div className="text-center mb-8 px-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="h-px w-16 bg-gradient-to-r from-transparent to-yellow-500/50"></span>
                <span className="text-yellow-500/70 text-lg leading-none">◆</span>
                <span className="h-px w-16 bg-gradient-to-l from-transparent to-yellow-500/50"></span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold gold-text gold-glow tracking-[0.15em] uppercase">
                Your Remaining Time
              </h1>
              <p className="mt-3 text-yellow-400/50 text-sm tracking-[0.3em] uppercase">
                {mounted ? currentTime.toLocaleTimeString() : "--:--:--"}
              </p>
            </div>

            <div className="space-y-6 px-8 sm:px-12 pb-8 flex-1 flex flex-col">
              <div className={`rounded-2xl p-8 flex-1 flex flex-col justify-center relative overflow-hidden transition-all duration-500 ${isWaiting ? "bg-neutral-800/80" : "gold-panel"}`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.15),transparent_50%)]"></div>
                <div className="relative flex items-center justify-between mb-4">
                  <span className={`text-xs font-semibold tracking-[0.25em] uppercase ${isWaiting ? "text-yellow-400/60" : "text-black/70"}`}>
                    {isWaiting ? "Waiting for" : "Current Batch"}
                  </span>
                  {!isWaiting && currentBatch && (
                    <span className="px-4 py-1.5 rounded-full bg-black/20 text-black text-xs font-bold tracking-widest uppercase border border-black/10">
                      Batch {currentBatch.id}
                    </span>
                  )}
                </div>
                
                <h2 className={`relative text-4xl sm:text-5xl font-bold tracking-wide ${isWaiting ? "text-yellow-100/70" : "text-black"}`}>
                  {isWaiting ? `Next: ${nextBatchLabel}` : currentBatch?.label}
                </h2>
                
                {isWaiting && (
                  <p className="relative mt-3 text-yellow-400/60">
                    Starts at {isWaiting && currentTime.getHours() < 9 ? "9:00 AM" : "9:00 AM tomorrow"}
                  </p>
                )}
              </div>

              <div className="bg-neutral-900/90 rounded-2xl p-8 flex-1 flex flex-col justify-center text-center border border-yellow-900/20 shadow-inner shadow-black/40">
                <div className="text-xs font-semibold text-yellow-400/70 uppercase tracking-[0.3em] mb-3">
                  Time Remaining
                </div>
                <div className="font-mono text-6xl sm:text-7xl font-bold gold-text gold-glow tabular-nums tracking-tight">
                  {formatMs(remainingMs)}
                </div>
                <div className="mt-3 text-sm text-yellow-400/50 tracking-wide">
                  {isWaiting 
                    ? `Until ${nextBatchLabel} batch starts`
                    : `Until Batch ${(currentBatch?.id || 0) % 4 + 1} starts`}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {BATCHES.map((batch) => (
                  <div
                    key={batch.id}
                    className={`py-4 px-2 rounded-xl text-center text-sm font-medium transition-all ${
                      currentBatch?.id === batch.id
                        ? `gold-panel text-black shadow-xl shadow-yellow-500/20 scale-105 ring-2 ring-yellow-300/70`
                        : "bg-neutral-800/60 text-yellow-400/60 border border-yellow-900/20 hover:border-yellow-500/40 hover:text-yellow-300 hover:bg-neutral-800"
                    }`}
                  >
                    <div className="font-bold tracking-widest">{batch.id}</div>
                    <div className="text-xs uppercase tracking-widest mt-1 opacity-80">{batch.label}</div>
                    <div className="text-xs opacity-60 mt-0.5">
                      {batch.startHour}:00-{batch.endHour}:00
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-5 border-t border-yellow-900/20 mt-auto">
                <div className="flex items-center justify-center gap-3 text-xs text-yellow-400/50 tracking-widest uppercase">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                    Live
                  </span>
                  <span className="text-yellow-500/30">◆</span>
                  <span>Updates every second</span>
                  <span className="text-yellow-500/30">◆</span>
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