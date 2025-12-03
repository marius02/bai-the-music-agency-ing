"use client";

import React from "react";
import TrackCard from "./TrackCard";

interface Track {
  id: string;
  title: string;
  genre: string;
  audioUrl: string;
  imageUrl?: string;
  duration?: string;
  lyrics?: string;
  vocalType?: string;
  mood?: string;
}

interface TrackGridProps {
  tracks: Track[];
  onGenerateAnother: () => void;
  onDeleteTrack: (trackId: string) => void;
  onGenerateVariation?: (track: Track, newGenre: string) => void;
}

export default function TrackGrid({
  tracks,
  onGenerateAnother,
  onDeleteTrack,
  onGenerateVariation,
}: TrackGridProps) {
  if (tracks.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-12 pb-24 md:pb-12 fade-in">
      {/* Success Header */}
      <div className="text-center mb-12 bg-gradient-to-r from-ing-orange/10 via-ing-orange/5 to-ing-orange/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-ing-orange/20 shadow-xl">
        <h2 className="text-4xl md:text-5xl font-black text-ing-dark mb-4 drop-shadow-sm">
          🎉 Muzica Ta ING Este Gata!
        </h2>
        <p className="text-xl text-ing-text">
          Ascultă, bucură-te și partajează creația ta muzicală
        </p>
      </div>

      {/* Tracks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {tracks.map((track) => (
          <TrackCard 
            key={track.id} 
            track={track} 
            onDelete={onDeleteTrack}
            onGenerateVariation={onGenerateVariation}
          />
        ))}
      </div>

      {/* Generate Another Button */}
      <div className="text-center">
        <button
          onClick={onGenerateAnother}
          className="group relative inline-flex items-center justify-center gap-3 bg-ing-orange hover:bg-ing-darkOrange text-white font-bold py-4 px-8 rounded-full transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-ing-orange/30 transform hover:scale-105 text-lg hidden md:inline-flex"
        >
          <span className="text-2xl group-hover:animate-bounce">🎵</span>
          <span>Creează Altă Piesă</span>
        </button>
      </div>

      {/* Mobile fixed CTA for quick generation */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 md:hidden z-50">
        <button
          onClick={onGenerateAnother}
          className="group relative inline-flex items-center justify-center gap-3 bg-ing-orange hover:bg-ing-darkOrange text-white font-bold py-3 px-6 rounded-full transition-all duration-300 shadow-xl w-[92vw]"
        >
          <span className="text-2xl">🎵</span>
          <span>Creează Altă Piesă</span>
        </button>
      </div>
    </div>
  );
}
