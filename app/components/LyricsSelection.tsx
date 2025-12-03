"use client";

import React from "react";

interface LyricsOption {
  text: string;
  title: string;
  status: string;
  errorMessage?: string;
}

interface LyricsSelectionProps {
  options: LyricsOption[];
  onSelect: (selectedLyrics: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export default function LyricsSelection({
  options,
  onSelect,
  onBack,
  isLoading = false,
}: LyricsSelectionProps) {
  const totalExpected = 2; // We always generate 2 lyrics
  const currentCount = options.length;
  const stillGenerating = currentCount < totalExpected;

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 md:p-12 shadow-2xl">
        {/* Dynamic Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-ing-orange/10 text-ing-orange px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <div className={`w-2 h-2 rounded-full ${stillGenerating ? 'bg-ing-orange animate-pulse' : 'bg-green-500'}`}></div>
            Step 2 of 3
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-ing-dark mb-3 animate-fadeIn">
            {stillGenerating 
              ? "🎵 Crafting Your Lyrics..."
              : "✨ Choose Your Perfect Lyrics"
            }
          </h2>
          
          <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto">
            {stillGenerating 
              ? (
                <span className="animate-fadeIn">
                  <span className="font-semibold text-ing-orange">{currentCount} of {totalExpected}</span> lyric versions ready! 
                  <span className="block mt-1 text-sm">🔄 Creating fresh variations with the same story...</span>
                </span>
              )
              : (
                <span>
                  We've created <span className="font-semibold text-ing-orange">{totalExpected} unique versions</span> of your story. 
                  <span className="block mt-1 text-sm">Pick your favorite and let's make some music! 🎶</span>
                </span>
              )
            }
          </p>
        </div>

        <div className="space-y-6">
          {options.map((option, index) => (
            <div
              key={index}
              className="group border-2 border-gray-300 rounded-xl p-6 hover:border-ing-orange hover:shadow-xl transition-all duration-300 bg-white relative overflow-hidden"
            >
              {/* Gradient accent on hover */}
              <div className="absolute top-0 left-0 w-full h-1 bg-ing-orange opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ing-orange flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-ing-dark">
                      {option.title || `Version ${index + 1}`}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {option.status === "complete" ? "✓ Ready to use" : "⚠ Generation failed"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onSelect(option.text)}
                  disabled={isLoading || option.status !== "complete"}
                  className="bg-ing-orange hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                >
                  {isLoading ? "Loading..." : "Select This →"}
                </button>
              </div>

              {option.status === "complete" ? (
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border border-gray-200 group-hover:border-ing-orange/30 transition-colors">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                    {option.text}
                  </pre>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
                  ⚠️ {option.errorMessage || "Failed to generate lyrics"}
                </div>
              )}
            </div>
          ))}

          {/* Show loading placeholder for remaining lyrics */}
          {stillGenerating && Array.from({ length: totalExpected - currentCount }).map((_, index) => (
            <div
              key={`loading-${index}`}
              className="border-2 border-dashed border-ing-orange/30 rounded-xl p-6 bg-gradient-to-br from-ing-orange/5 to-white relative overflow-hidden"
            >
              {/* Animated shimmer effect */}
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-lg animate-pulse">
                    {currentCount + index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-400">
                      Version {currentCount + index + 1}
                    </h3>
                    <span className="text-xs text-ing-orange font-semibold animate-pulse">
                      🔄 Twisting your lyrics...
                    </span>
                  </div>
                </div>
                <button
                  disabled
                  className="bg-gray-300 text-gray-500 font-bold py-2 px-6 rounded-lg text-sm opacity-30 cursor-not-allowed"
                >
                  Generating...
                </button>
              </div>
              
              <div className="bg-gradient-to-br from-gray-100 to-white rounded-lg p-6 border border-gray-200 h-56 flex flex-col items-center justify-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 border-4 border-ing-orange/20 border-t-ing-orange rounded-full animate-spin"></div>
                  <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-orange-300 rounded-full animate-spin-slow"></div>
                </div>
                <p className="text-gray-600 text-sm font-semibold mb-1">Creating fresh variations...</p>
                <p className="text-gray-400 text-xs">Using the same story you love ✨</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={onBack}
            disabled={isLoading}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-8 rounded-xl transition-all disabled:opacity-50"
          >
            ← Back to Edit Prompt
          </button>
        </div>
      </div>
    </div>
  );
}
