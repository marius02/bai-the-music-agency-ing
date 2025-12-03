'use client'

import React, { useState, useEffect } from 'react'

interface LoaderProps {
  message?: string
  queueStatus?: {
    position?: number;
    estimatedWait?: number;
    message?: string;
    attempts?: number;
    maxRetries?: number;
  }
}

export default function Loader({ 
  message = 'Creăm muzica ta ING... te rugăm așteaptă 🎧',
  queueStatus 
}: LoaderProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedProgress, setEstimatedProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
      
      // Estimate progress based on actual Suno API streaming behavior:
      // PHASE 1: Stream preview ready at ~20-30s (fast playback)
      // PHASE 2: Full quality ready at ~2-5 minutes (full download)
      // Progress curve optimized for two-phase delivery
      let progress = 0;
      if (elapsed < 10) {
        // 0-10s: Initialization (0-20%)
        progress = (elapsed / 10) * 20;
      } else if (elapsed < 25) {
        // 10-25s: Preparing stream preview (20-60%)
        progress = 20 + ((elapsed - 10) / 15) * 40;
      } else if (elapsed < 35) {
        // 25-35s: Stream preview ready! (60-70%)
        progress = 60 + ((elapsed - 25) / 10) * 10;
      } else if (elapsed < 90) {
        // 35-90s: Full quality generation starts (70-80%)
        progress = 70 + ((elapsed - 35) / 55) * 10;
      } else if (elapsed < 180) {
        // 90-180s: Generating full quality audio (80-90%)
        progress = 80 + ((elapsed - 90) / 90) * 10;
      } else if (elapsed < 300) {
        // 180-300s: Finalizing full quality (90-95%)
        progress = 90 + ((elapsed - 180) / 120) * 5;
      } else {
        // 300s+: Almost complete (95-98%)
        progress = 95 + Math.min(((elapsed - 300) / 60) * 3, 3);
      }
      
      setEstimatedProgress(Math.min(progress, 98)); // Cap at 98% until complete
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusMessage = () => {
    if (elapsedTime < 10) return "Inițializăm generarea muzicii ING...";
    if (elapsedTime < 25) return "Pregătim previzualizarea...";
    if (elapsedTime < 35) return "🎧 Previzualizare aproape gata!";
    if (elapsedTime < 90) return "Previzualizare gata! Generăm calitate înaltă...";
    if (elapsedTime < 180) return "Creăm audio de calitate înaltă...";
    if (elapsedTime < 300) return "Finalizăm descărcarea de calitate înaltă...";
    return "Aproape gata...";
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 fade-in">
      <div className="relative">
        {/* ING Logo */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          <div className="text-9xl font-black text-ing-orange animate-pulse">
            ING
          </div>
          
          {/* Rotating orange circle overlay */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-56 h-56 border-[6px] border-transparent border-t-ing-orange border-r-ing-orange rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-ing-dark text-xl font-semibold text-center max-w-md px-4">
        {message}
      </p>
      
      {/* Queue Status Banner */}
      {queueStatus?.position && (
        <div className="mt-6 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-lg border-2 border-white/40 rounded-2xl p-5 max-w-md mx-auto shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-ing-orange rounded-full animate-pulse"></div>
              <span className="text-white/80 text-xs font-semibold tracking-wide uppercase">In Queue</span>
            </div>
            <div className="text-white/60 text-[10px] font-mono bg-white/10 px-2 py-1 rounded">
              {queueStatus.estimatedWait && queueStatus.estimatedWait > 60 
                ? `~${Math.ceil(queueStatus.estimatedWait / 60)} min`
                : `~${queueStatus.estimatedWait}s`}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="text-5xl font-black text-white drop-shadow-lg">
                  #{queueStatus.position}
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-300 rounded-full border-2 border-white animate-ping"></div>
              </div>
            </div>
            
            <div className="flex-1 border-l-2 border-white/20 pl-4">
              <div className="text-white text-sm font-semibold mb-1">
                Your position in queue
              </div>
              <div className="text-white/70 text-xs leading-relaxed">
                {queueStatus.estimatedWait && queueStatus.estimatedWait > 60 
                  ? "🎵 High demand right now! Your song is coming up..."
                  : "🚀 Almost your turn! Hang tight..."}
              </div>
            </div>
          </div>
          
          {/* Queue Progress Bar */}
          {queueStatus.estimatedWait && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-[10px] text-white/60 mb-1.5">
                <span>Waiting</span>
                <span>Processing soon</span>
              </div>
              <div className="bg-white/20 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-ing-orange animate-pulse"
                  style={{ width: `${Math.max(10, 100 - (queueStatus.position * 5))}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {queueStatus?.message && !queueStatus.position && (
        <div className="mt-4 bg-white/10 backdrop-blur-md border-2 border-white/30 rounded-xl p-3 max-w-sm mx-auto">
          <div className="text-center text-white/90 text-sm font-semibold">
            {queueStatus.message}
          </div>
          {/* Show retry indicator only on 2nd retry and beyond (after first failure) */}
          {queueStatus.attempts && queueStatus.attempts > 1 && (
            <div className="mt-2 text-center text-white/70 text-xs">
              🔄 Retry {queueStatus.attempts}/{queueStatus.maxRetries || 3}
            </div>
          )}
        </div>
      )}
      
      {/* Progress Bar */}
      <div className="w-full max-w-md mt-6 px-4">
        <div className="bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-sm">
          <div 
            className="h-full bg-gradient-to-r from-ing-orange to-orange-400 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${estimatedProgress}%` }}
          ></div>
        </div>
        
        {/* Progress percentage and time */}
        <div className="flex justify-between items-center mt-3 text-ing-dark text-sm">
          <span className="font-medium">{Math.floor(estimatedProgress)}%</span>
          <span className="font-mono">{formatTime(elapsedTime)}</span>
        </div>
        
        {/* Status message */}
        <p className="text-center text-ing-text text-sm mt-4 font-medium">
          {getStatusMessage()}
        </p>
      </div>
      
      {/* Animated dots */}
      <div className="flex space-x-2 mt-6">
        <div className="w-3 h-3 bg-ing-orange rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-3 h-3 bg-ing-orange rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-3 h-3 bg-ing-orange rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
      </div>
    </div>
  )
}
