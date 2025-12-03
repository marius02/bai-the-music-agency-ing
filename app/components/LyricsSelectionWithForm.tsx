"use client";

import React, { useState } from "react";

interface LyricsOption {
  text: string;
  title: string;
  status: string;
  errorMessage?: string;
}

interface MusicFormData {
  genre: string;
  vocalType: "male" | "female" | "duet";
  title?: string;
  remixedBy?: string;
  mood: "sad" | "chill" | "creative" | "hype";
}

interface LyricsSelectionWithFormProps {
  options: LyricsOption[];
  onSubmit: (selectedLyrics: string, formData: MusicFormData) => void;
  onBack: () => void;
  onRegenerateLyrics?: () => void;
  onLyricsSelected?: (hasSelection: boolean) => void;
  isLoading?: boolean;
}

const genres = [
  "⭐ Original",
  "Upbeat Pop",
  "Pop Rock",
  "Electronic Dance",
  "Hip Hop",
  "R&B Soul",
  "Acoustic",
  "Jazz",
  "Indie Pop",
  "Latin Pop",
  "Funk",
  "Reggae",
  "House",
  "Chill Vibes",
  "Rock",
  "Ambient",
];

// Mood to BPM mapping
const moodConfig = {
  sad: {
    label: "Sad",
    emoji: "😢",
    bpm: "60-80 BPM",
    description: "Slow & Emotional",
    color: "from-blue-400 to-blue-600",
    suggestedGenres: ["Acoustic", "R&B Soul", "Ambient"],
  },
  chill: {
    label: "Chill",
    emoji: "😌",
    bpm: "80-100 BPM",
    description: "Relaxed & Smooth",
    color: "from-green-400 to-green-600",
    suggestedGenres: ["Chill Vibes", "Jazz", "Reggae"],
  },
  creative: {
    label: "Creative",
    emoji: "🎨",
    bpm: "100-120 BPM",
    description: "Artistic & Unique",
    color: "from-purple-400 to-purple-600",
    suggestedGenres: ["Indie Pop", "Funk", "Latin Pop"],
  },
  hype: {
    label: "Hype",
    emoji: "🔥",
    bpm: "120-140 BPM",
    description: "Fast & Energetic",
    color: "from-red-400 to-red-600",
    suggestedGenres: ["Electronic Dance", "House", "Hip Hop"],
  },
};

export default function LyricsSelectionWithForm({
  options,
  onSubmit,
  onBack,
  onRegenerateLyrics,
  onLyricsSelected,
  isLoading = false,
}: LyricsSelectionWithFormProps) {
  const [selectedLyrics, setSelectedLyrics] = useState<string>("");
  const [formData, setFormData] = useState<MusicFormData>({
    genre: "Upbeat Pop",
    vocalType: "male",
    title: "",
    remixedBy: "",
    mood: "creative",
  });
  const [recommendedGenre, setRecommendedGenre] = useState<string | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState<string>("");

  // AI genre recommendation based on lyrics
  const recommendGenre = (lyrics: string) => {
    setIsRecommending(true);

    // Simple AI-like analysis based on keywords and themes
    const lyricsLower = lyrics.toLowerCase();

    // Emotional/slow keywords
    if (
      lyricsLower.match(
        /\b(sad|cry|tears|heartbreak|alone|lost|miss|goodbye|pain|sorrow)\b/
      )
    ) {
      setRecommendedGenre("R&B Soul");
    }
    // Party/energetic keywords
    else if (
      lyricsLower.match(
        /\b(party|dance|night|club|beat|hype|energy|wild|celebrate)\b/
      )
    ) {
      setRecommendedGenre("Electronic Dance");
    }
    // Romantic keywords
    else if (
      lyricsLower.match(
        /\b(love|heart|kiss|romance|forever|together|beautiful|sweet)\b/
      )
    ) {
      setRecommendedGenre("Pop Rock");
    }
    // Chill/relaxed keywords
    else if (
      lyricsLower.match(
        /\b(chill|relax|sunset|beach|breeze|smooth|calm|peaceful)\b/
      )
    ) {
      setRecommendedGenre("Chill Vibes");
    }
    // Urban/street keywords
    else if (
      lyricsLower.match(/\b(street|hustle|grind|city|flow|vibe|swagger|boss)\b/)
    ) {
      setRecommendedGenre("Hip Hop");
    }
    // Nostalgic/reflective keywords
    else if (
      lyricsLower.match(
        /\b(memory|remember|yesterday|past|old|nostalg|childhood|back then)\b/
      )
    ) {
      setRecommendedGenre("Indie Pop");
    }
    // Latin/tropical keywords
    else if (
      lyricsLower.match(
        /\b(fiesta|caliente|latino|tropical|salsa|bailar|ritmo)\b/
      )
    ) {
      setRecommendedGenre("Latin Pop");
    }
    // Funky/groovy keywords
    else if (
      lyricsLower.match(/\b(funk|groove|soul|boogie|rhythm|bass|jam)\b/)
    ) {
      setRecommendedGenre("Funk");
    }
    // Default to current mood-based suggestion
    else {
      setRecommendedGenre("Upbeat Pop");
    }

    setTimeout(() => setIsRecommending(false), 500);
  };

  const handleLyricsSelect = (lyrics: string) => {
    setSelectedLyrics(lyrics);
    setEditedLyrics(lyrics); // Initialize edited lyrics with selected
    setIsEditingLyrics(false); // Reset editing state
    // Recommend genre based on lyrics
    recommendGenre(lyrics);
    // Notify parent component that lyrics have been selected
    if (onLyricsSelected) {
      onLyricsSelected(!!lyrics);
    }
  };

  const handleEditLyrics = () => {
    setIsEditingLyrics(true);
  };

  const handleSaveEditedLyrics = () => {
    setSelectedLyrics(editedLyrics);
    setIsEditingLyrics(false);
    // Update genre recommendation based on edited lyrics
    recommendGenre(editedLyrics);
  };

  const handleCancelEdit = () => {
    setEditedLyrics(selectedLyrics); // Revert to original
    setIsEditingLyrics(false);
  };

  const applyRecommendedGenre = () => {
    if (recommendedGenre) {
      setFormData({ ...formData, genre: recommendedGenre });
    }
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ ...formData, genre: e.target.value });
  };

  const handleVocalChange = (value: "male" | "female" | "duet") => {
    setFormData({ ...formData, vocalType: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lyricsToSubmit = isEditingLyrics ? editedLyrics : selectedLyrics;
    if (lyricsToSubmit) {
      onSubmit(lyricsToSubmit, formData);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div className="bg-white backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-lg border border-ing-accent">
        {/* Step Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-ing-dark mb-2">
            Pasul 2: Alege Versurile Tale
          </h2>
          <p className="text-ing-text">
            {isLoading
              ? "Generating new lyrics..."
              : "We've created 2 unique versions. Pick your favorite!"}
          </p>
        </div>

        {/* Loading State during ReTwist */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="spinner w-16 h-16 mx-auto mb-4"></div>
            <p className="text-xl text-ing-orange font-semibold">
              ✨ Creăm variante noi pentru tine...
            </p>
            <p className="text-ing-text mt-2">
              Transformăm visul tău în versuri unice
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Lyrics Options */}
          {!isLoading && (
            <div className="space-y-6 mb-8">
              {options.map((option, index) => {
                const isSelected = Boolean(
                  selectedLyrics === option.text ||
                    (selectedLyrics &&
                      !options.some((opt) => opt.text === selectedLyrics) &&
                      index === 0)
                );

                return (
                  <div
                    key={index}
                    className={`border-2 rounded-xl p-6 transition-all ${
                      isSelected
                        ? "border-ing-orange bg-ing-orange/5 shadow-lg ring-2 ring-ing-orange ring-offset-2"
                        : "border-gray-300 hover:border-ing-orange bg-white hover:shadow-md cursor-pointer"
                    }`}
                    onClick={() =>
                      !isSelected &&
                      option.status === "complete" &&
                      handleLyricsSelect(option.text)
                    }
                  >
                    <div className="flex items-start mb-4">
                      <input
                        type="radio"
                        name="lyrics"
                        checked={isSelected}
                        onChange={() => handleLyricsSelect(option.text)}
                        className="mt-1 mr-3 w-5 h-5 text-ing-orange focus:ring-ing-orange"
                        disabled={option.status !== "complete"}
                      />
                      <div className="flex-1">
                        <h3 className="text-lg md:text-xl font-semibold text-ing-dark mb-3">
                          Option {index + 1}
                          {option.title && ` - ${option.title}`}
                        </h3>
                        <div className="flex items-start justify-between gap-3">
                          {isSelected && (
                            <span className="inline-flex items-center bg-ing-orange text-white text-xs font-bold px-3 py-1 rounded-full h-7">
                              SELECTAT ✓
                            </span>
                          )}
                          {/* Edit Button - appears when this option is selected */}
                          {isSelected && !isEditingLyrics && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditLyrics();
                              }}
                              className="ml-auto bg-white hover:bg-ing-orange/10 text-ing-orange border-2 border-ing-orange font-semibold py-1 px-3 rounded-full transition-all flex items-center gap-2 text-xs sm:text-sm flex-shrink-0 shadow-sm hover:shadow-md h-7"
                              title="Editează Versurile"
                            >
                              <span className="text-base leading-none">✏️</span>
                              <span className="hidden sm:inline">
                                Editează
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {option.status === "complete" ? (
                      <div className="bg-gray-50 rounded-lg p-4 ml-8">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono max-h-60 overflow-y-auto">
                          {isSelected ? selectedLyrics : option.text}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-red-500 ml-8">
                        {option.errorMessage || "Failed to generate lyrics"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit Lyrics Section - appears when user clicks Edit */}
          {selectedLyrics && !isLoading && isEditingLyrics && (
            <div className="border-t-2 border-gray-200 pt-6 md:pt-8 mt-6 md:mt-8 mb-6 md:mb-8 fade-in">
              <div className="text-center mb-4 md:mb-6">
                <h3 className="text-xl md:text-2xl font-bold text-ing-dark mb-2">
                  ✏️ Edit Your Lyrics
                </h3>
                <p className="text-sm md:text-base text-gray-600">
                  Customize the lyrics to make them perfect (max 3000
                  characters)
                </p>
              </div>

              <div className="bg-white rounded-xl border-2 border-ing-orange p-4 md:p-6">
                <textarea
                  value={editedLyrics}
                  onChange={(e) => setEditedLyrics(e.target.value)}
                  className="w-full min-h-[200px] md:min-h-[300px] p-3 md:p-4 rounded-lg border-2 border-gray-300 focus:border-ing-orange focus:outline-none transition-all font-mono text-xs md:text-sm"
                  placeholder="Edit your lyrics here..."
                  maxLength={3000}
                />

                {/* Character Counter */}
                <div className="flex items-center justify-between mt-2">
                  <div
                    className={`text-sm font-semibold ${
                      editedLyrics.length > 3000
                        ? "text-red-500"
                        : editedLyrics.length > 2700
                        ? "text-orange-500"
                        : "text-gray-600"
                    }`}
                  >
                    {editedLyrics.length} / 3000 characters
                    {editedLyrics.length > 3000 && (
                      <span className="ml-2 text-red-500">
                        ({editedLyrics.length - 3000} over limit!)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:justify-end">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-all w-full sm:w-auto"
                  >
                    Anulează
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditedLyrics}
                    className="bg-ing-orange hover:bg-ing-darkOrange text-white font-semibold py-2 px-6 rounded-lg transition-all w-full sm:w-auto"
                  >
                    Salvează Modificările
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Show music options only if lyrics are selected */}
          {selectedLyrics && !isLoading && !isEditingLyrics && (
            <div className="border-t-2 border-gray-200 pt-6 md:pt-8 mt-6 md:mt-8 fade-in">
              <div className="text-center mb-4 md:mb-6">
                <h3 className="text-xl md:text-2xl font-bold text-ing-dark mb-2">
                  Pasul 3: Alege Stilul Muzical
                </h3>
                <p className="text-sm md:text-base text-ing-text">
                  Selectează genul și preferințele vocale pentru piesa ta
                </p>
              </div>

              {/* Mood/BPM Slider */}
              <div className="mb-6 md:mb-8">
                <label className="block text-ing-dark font-semibold text-base md:text-lg mb-3 md:mb-4 text-center">
                  Energia & Tempo-ul Piesei
                </label>
                <div className="bg-gradient-to-r from-blue-50 via-green-50 via-purple-50 to-red-50 rounded-xl md:rounded-2xl p-4 md:p-6">
                  {/* Mood Options Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-4">
                    {(
                      Object.keys(moodConfig) as Array<keyof typeof moodConfig>
                    ).map((moodKey) => {
                      const mood = moodConfig[moodKey];
                      const isSelected = formData.mood === moodKey;
                      return (
                        <button
                          key={moodKey}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, mood: moodKey })
                          }
                          disabled={isLoading}
                          className={`p-3 md:p-4 rounded-lg md:rounded-xl border-2 transition-all ${
                            isSelected
                              ? `border-ing-orange bg-gradient-to-br ${mood.color} text-white shadow-xl scale-105`
                              : "border-gray-300 bg-white hover:border-ing-orange hover:shadow-md"
                          } ${
                            isLoading
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer"
                          }`}
                        >
                          <div className="font-bold text-sm md:text-base mb-2">
                            {mood.label}
                          </div>
                          <div
                            className={`text-xs md:text-sm ${
                              isSelected ? "text-white" : "text-gray-600"
                            }`}
                          >
                            {mood.bpm}
                          </div>
                          <div
                            className={`text-[10px] md:text-xs mt-1 ${
                              isSelected ? "text-white/90" : "text-gray-500"
                            }`}
                          >
                            {mood.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Current Selection Info */}
                  <div className="text-center mt-3 md:mt-4 p-2 md:p-3 bg-white/80 rounded-lg">
                    <p className="text-xs md:text-sm text-gray-700">
                      <span className="font-semibold">Selected:</span>{" "}
                      {moodConfig[formData.mood].label}
                      <span className="mx-1 md:mx-2">•</span>
                      <span className="font-semibold">
                        {moodConfig[formData.mood].bpm}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Genre Dropdown */}
              <div className="mb-6 md:mb-8">
                <label
                  htmlFor="genre"
                  className="block text-ing-dark font-semibold text-base md:text-lg mb-3"
                >
                  Alege un Gen Muzical
                </label>

                {/* AI Recommendation Banner */}
                {recommendedGenre && (
                  <div className="mb-4 p-3 md:p-4 bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-300 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="text-xl md:text-2xl">🤖</div>
                        <div>
                          <p className="text-base md:text-lg font-bold text-purple-900">
                            {recommendedGenre}
                          </p>
                          <p className="text-[10px] md:text-xs text-purple-700">
                            Based on your lyrics analysis
                          </p>
                        </div>
                      </div>
                      {formData.genre !== recommendedGenre && (
                        <button
                          type="button"
                          onClick={applyRecommendedGenre}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm w-full sm:w-auto"
                          disabled={isLoading}
                        >
                          Apply ✨
                        </button>
                      )}
                      {formData.genre === recommendedGenre && (
                        <div className="bg-green-500 text-white px-3 py-2 rounded-lg text-xs md:text-sm font-bold text-center">
                          ✓ Applied
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <select
                  id="genre"
                  value={formData.genre}
                  onChange={handleGenreChange}
                  className="w-full p-3 rounded-lg border-2 border-gray-300 focus:border-ing-orange focus:outline-none transition-all"
                  disabled={isLoading}
                >
                  {genres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remixed By Input - Hidden */}
              {false && (
              <div className="mb-6 md:mb-8">
                <label
                  htmlFor="remixedBy"
                  className="block text-ing-dark font-semibold text-base md:text-lg mb-3"
                >
                  Remixed By - @handle
                </label>
                <input
                  type="text"
                  id="remixedBy"
                  value={formData.remixedBy}
                  onChange={(e) =>
                    setFormData({ ...formData, remixedBy: e.target.value })
                  }
                  placeholder="@yourhandle or your Instagram/TikTok"
                  className="w-full p-3 rounded-lg border-2 border-gray-300 focus:border-ing-orange focus:outline-none transition-all text-sm md:text-base"
                  disabled={isLoading}
                />
                <p className="text-xs md:text-sm text-gray-500 mt-2">
                  🎧 Add your Instagram or TikTok handle
                </p>
              </div>
              )}

              {/* Title Input (Optional) */}
              <div className="mb-6 md:mb-8">
                <label
                  htmlFor="title"
                  className="block text-ing-dark font-semibold text-base md:text-lg mb-3"
                >
                  Titlu (Opțional)
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Lasă gol pentru titlu auto-generat"
                  className="w-full p-3 rounded-lg border-2 border-gray-300 focus:border-ing-orange focus:outline-none transition-all text-sm md:text-base"
                  disabled={isLoading}
                />
              </div>

              {/* Vocal Type Radio Buttons */}
              <div className="mb-8 md:mb-10">
                <label className="block text-ing-dark font-semibold text-base md:text-lg mb-3 md:mb-4">
                  Preferințe Vocale
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {[
                    { value: "male", label: "🎤 Voce Masculină", icon: "♂️" },
                    { value: "female", label: "🎤 Voce Feminină", icon: "♀️" },
                    {
                      value: "duet",
                      label: "🎤 Duet (Masculin & Feminin)",
                      icon: "👥",
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`radio-option flex-1 cursor-pointer ${
                        isLoading ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="vocalType"
                        value={option.value}
                        checked={formData.vocalType === option.value}
                        onChange={() =>
                          handleVocalChange(
                            option.value as "male" | "female" | "duet"
                          )
                        }
                        className="sr-only"
                        disabled={isLoading}
                      />
                      <div
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          formData.vocalType === option.value
                            ? "border-ing-orange bg-ing-orange/10 shadow-lg"
                            : "border-gray-300 bg-white hover:border-ing-orange/40"
                        }`}
                      >
                        <div className="text-2xl mb-2">{option.icon}</div>
                        <div className="font-semibold text-sm">
                          {option.label}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate Music Button */}
              <div className="text-center">
                <button
                  type="submit"
                  disabled={isLoading || !selectedLyrics}
                  className="bg-ing-orange text-white font-bold py-4 px-10 rounded-full text-xl md:text-2xl hover:bg-orange-600 transition-all shadow-lg shadow-ing-orange/20 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed w-full uppercase tracking-wider"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="spinner w-6 h-6"></div>
                      <span>LOADING</span>
                    </div>
                  ) : (
                    <span>DREAM ING</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Back and Regenerate Lyrics Buttons */}
          <div className="mt-8 text-center">
            {/* Desktop: Horizontal layout */}
            <div className="hidden md:flex gap-4 justify-center">
              <button
                type="button"
                onClick={onBack}
                disabled={isLoading}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-8 rounded-xl transition-all disabled:opacity-50"
              >
                ← Înapoi la Editare
              </button>

              <button
                type="button"
                onClick={onRegenerateLyrics}
                disabled={isLoading}
                className="bg-white hover:bg-ing-orange/10 text-ing-orange border-2 border-ing-orange font-semibold py-3 px-8 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
              >
                🔄 Generează versuri noi
              </button>
            </div>

            {/* Mobile: Vertical layout, full width */}
            <div className="md:hidden flex flex-col gap-3">
              <button
                type="button"
                onClick={onRegenerateLyrics}
                disabled={isLoading}
                className="bg-white hover:bg-ing-orange/10 text-ing-orange border-2 border-ing-orange font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full"
              >
                🔄 Generează versuri noi
              </button>

              <button
                type="button"
                onClick={onBack}
                disabled={isLoading}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 w-full"
              >
                ← Înapoi la Editare
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
