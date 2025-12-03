'use client'

import React, { useRef, useEffect, useState } from 'react'

interface Track {
  id: string
  title: string
  genre: string
  audioUrl: string
  streamUrl?: string
  imageUrl?: string
  duration?: string
  lyrics?: string
  vocalType?: string
  mood?: string
  isStreaming?: boolean // Track is currently streaming (preview mode)
  isUpgrading?: boolean
}

interface TrackCardProps {
  track: Track
  onDelete: (trackId: string) => void
  onGenerateVariation?: (track: Track, newGenre: string) => void
}

// Global reference to currently playing audio element
let currentlyPlaying: HTMLAudioElement | null = null;

const alternativeGenres = [
  "Electronic Dance",
  "Hip Hop",
  "House",
  "Pop Rock",
  "R&B Soul",
  "Jazz",
  "Reggae",
  "Funk",
  "Chill Vibes",
  "Acoustic"
];

export default function TrackCard({ track, onDelete, onGenerateVariation }: TrackCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showGenreMenu, setShowGenreMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isGeneratingVariation, setIsGeneratingVariation] = useState(false);

  useEffect(() => {
    const audioElement = audioRef.current;
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
  }, []);
  const handleDownload = async () => {
    try {
      const response = await fetch(track.audioUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${track.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Eroare la descărcarea piesei. Te rugăm să încerci din nou.')
    }
  }

  const handleDelete = () => {
    if (window.confirm(`Ești sigur că vrei să ștergi "${track.title}"?`)) {
      onDelete(track.id)
    }
  }

  const handleGenerateVariation = async (newGenre: string) => {
    if (!onGenerateVariation) return;
    
    setIsGeneratingVariation(true);
    setShowGenreMenu(false);
    
    try {
      await onGenerateVariation(track, newGenre);
    } catch (error) {
      console.error('Failed to generate variation:', error);
    } finally {
      setIsGeneratingVariation(false);
    }
  }

  const handleShare = (platform: 'instagram' | 'tiktok' | 'facebook') => {
    const shareText = `Descoperă piesa mea ING: "${track.title}" 🎵🎶\nCreată cu ING Romania Music Experience`;
    const shareUrl = window.location.href;
    
    let url = '';
    
    switch (platform) {
      case 'instagram':
        // Instagram doesn't support direct sharing via URL, copy to clipboard instead
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert('✓ Track info copied to clipboard! Paste it in your Instagram post or story.');
        break;
      case 'tiktok':
        // TikTok doesn't have direct web share, copy to clipboard
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert('✓ Track info copied to clipboard! Paste it in your TikTok caption.');
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank', 'width=600,height=400');
        break;
    }
    
    setShowShareMenu(false);
  }

  // Filter out the current genre from alternatives
  const availableGenres = alternativeGenres.filter(g => g !== track.genre);

  return (
    <div className="track-card bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl relative">
      {/* Delete Button - Top Right Corner */}
      <button
        onClick={handleDelete}
        className="absolute top-3 left-3 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110"
        title="Delete track"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
          />
        </svg>
      </button>

      {/* Track Image/Icon */}
      <div className="relative mb-4">
        {track.imageUrl ? (
          <img 
            src={track.imageUrl} 
            alt={track.title}
            className="w-full h-48 object-cover rounded-xl"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-ing-orange to-orange-400 rounded-xl flex items-center justify-center">
            <div className="text-6xl">🎵</div>
          </div>
        )}
        
        {/* Genre Badge */}
        <div className="absolute top-3 right-3 bg-ing-orange text-white px-3 py-1 rounded-full text-sm font-semibold">
          {track.genre}
        </div>
      </div>

      {/* Track Info */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-ing-dark mb-1 truncate">
            {track.title}
          </h3>
          {track.isStreaming && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full animate-pulse">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
              </svg>
              Preview
            </span>
          )}
          {track.isUpgrading && !track.isStreaming && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full animate-pulse">
              <svg className="w-3 h-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Upgrading...
            </span>
          )}
        </div>
        {track.isStreaming && (
          <p className="text-xs text-green-600 font-medium mt-1">
            🎧 Previzualizare aproape gata! Se descarcă calitate maximă...
          </p>
        )}
        {track.duration && (
          <p className="text-sm text-gray-500">Durată: {track.duration}</p>
        )}
      </div>

      {/* Audio Player */}
      <div className="mb-4">
        <audio 
          ref={audioRef}
          controls 
          className="w-full"
          preload="metadata"
        >
          <source src={track.audioUrl} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Download button - full width */}
        <div className="w-full">
          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="w-full bg-ing-orange hover:bg-ing-darkOrange text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
            title="Descarcă Piesa"
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
              />
            </svg>
            <span>Descarcă</span>
          </button>
        </div>
      </div>
    </div>
  )
}