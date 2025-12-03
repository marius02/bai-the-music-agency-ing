'use client'

import React, { useRef, useEffect } from 'react'

interface Track {
  id: string
  title: string
  genre: string
  audioUrl: string
  streamUrl?: string
  imageUrl?: string
  duration?: string
  isStreaming?: boolean
  isUpgrading?: boolean
}

interface PreviewPlayerProps {
  tracks: Track[]
  message?: string
}

// Global reference to currently playing audio element
let currentlyPlaying: HTMLAudioElement | null = null;

export default function PreviewPlayer({ tracks, message }: PreviewPlayerProps) {
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  useEffect(() => {
    // Setup play event listeners for all audio elements
    audioRefs.current.forEach((audioElement) => {
      if (!audioElement) return;

      const handlePlay = () => {
        // Pause the currently playing audio if it's different from this one
        if (currentlyPlaying && currentlyPlaying !== audioElement) {
          currentlyPlaying.pause();
        }
        // Set this audio as the currently playing one
        currentlyPlaying = audioElement;
      };

      audioElement.addEventListener('play', handlePlay);
      
      return () => {
        audioElement.removeEventListener('play', handlePlay);
      };
    });
  }, [tracks]);

  return (
    <div className="flex flex-col items-center justify-center py-8 fade-in max-w-4xl mx-auto px-4">
      {/* Success Header */}
      <div className="text-center mb-8 animate-fade-in-up">
        <div className="inline-flex items-center gap-3 bg-ing-orange/20 backdrop-blur-md px-6 py-3 rounded-full border-2 border-ing-orange/50 mb-4">
          <div className="w-3 h-3 bg-ing-orange rounded-full animate-pulse"></div>
          <span className="text-ing-orange font-semibold text-lg">Previzualizare Gata!</span>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-bold text-ing-dark mb-3 drop-shadow-lg">
          🎧 Începe să Asculți Acum
        </h2>
        
        <p className="text-ing-text text-base md:text-lg mb-2">
          {message || "Previzualizarea ta este gata! Calitatea înaltă se generează în continuare..."}
        </p>
        
        <p className="text-ing-text/70 text-sm">
          Descărcarea de calitate înaltă va fi disponibilă în ~2-4 minute
        </p>
      </div>

      {/* Preview Tracks */}
      <div className="w-full space-y-4">
        {tracks.map((track, index) => (
          <div 
            key={track.id}
            className="bg-white backdrop-blur-lg rounded-2xl p-5 border border-ing-accent hover:border-ing-orange transition-all duration-300 animate-fade-in-up shadow-lg"
            style={{ animationDelay: `${index * 0.2}s` }}
          >
            <div className="flex items-start gap-4">
              {/* Track Image/Icon */}
              <div className="flex-shrink-0">
                {track.imageUrl ? (
                  <img 
                    src={track.imageUrl} 
                    alt={track.title}
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-ing-orange to-orange-400 rounded-xl flex items-center justify-center">
                    <div className="text-3xl">🎵</div>
                  </div>
                )}
              </div>

              {/* Track Info & Player */}
              <div className="flex-1 min-w-0">
                {/* Title and Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-ing-dark truncate">
                    {track.title}
                  </h3>
                  {track.isStreaming && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-ing-orange/20 text-ing-orange text-xs font-medium rounded-full border border-ing-orange/50 animate-pulse flex-shrink-0">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                      </svg>
                      Previzualizare
                    </span>
                  )}
                </div>

                {/* Genre */}
                <p className="text-sm text-ing-text mb-3">
                  {track.genre} {track.duration && `• ${track.duration}`}
                </p>

                {/* Audio Player */}
                <audio 
                  ref={(el) => { audioRefs.current[index] = el; }}
                  controls 
                  className="w-full audio-player-preview"
                  preload="metadata"
                >
                  <source src={track.audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>

                {/* Upgrading Notice */}
                {track.isUpgrading && (
                  <p className="text-xs text-ing-text/70 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generăm calitate înaltă în fundal...
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-8 px-6 py-4 bg-ing-orange/10 backdrop-blur-md rounded-2xl border border-ing-orange/30 max-w-2xl w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-ing-orange" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-ing-dark font-semibold text-sm mb-1">Ce se întâmplă?</h4>
            <p className="text-ing-text text-xs leading-relaxed">
              Asculți o <strong className="text-ing-dark">previzualizare</strong> - calitate perfectă pentru a te bucura chiar acum! 
              Între timp, generăm <strong className="text-ing-dark">versiunea de calitate înaltă</strong> cu audio îmbunătățit pentru descărcare. 
              Piesele vor fi upgrade automat când sunt gata.
            </p>
          </div>
        </div>
      </div>

      {/* Continue Generating Indicator */}
      <div className="mt-6 flex items-center gap-3">
        {/* Spinning loader icon */}
        <div className="w-8 h-8 animate-spin">
          <div className="w-full h-full rounded-full border-4 border-ing-orange border-t-transparent"></div>
        </div>
        <span className="text-ing-text/70 text-sm">Se generează calitate înaltă...</span>
      </div>
    </div>
  )
}
