"use client";

import React, { useState, useEffect } from "react";

interface FormData {
  selectedSong: string;
  prompt: string;
  genre: string;
  vocalType: "male" | "female" | "instrumental";
}

interface InputFormProps {
  onGenerateLyrics: (
    prompt: string,
    selectedSong: string,
    moods: string[]
  ) => void;
  isLoading: boolean;
  showPromptOnly?: boolean;
  cachedPrompt?: string;
  cachedSong?: string;
  cachedMoods?: string[];
  onClear?: () => void;
}

const moods = [
  {
    value: "upbeat",
    label: "Upbeat & Energetic",
    emoji: "🎉",
    description: "Fun, party vibes",
    icon: "/assets/img/pepsi-icon.svg",
  },
  {
    value: "romantic",
    label: "Romantic & Sweet",
    emoji: "💕",
    description: "Love and nostalgia",
    icon: "/assets/img/pepsi-icon.svg",
  },
  {
    value: "chill",
    label: "Chill & Relaxed",
    emoji: "😌",
    description: "Calm and peaceful",
    icon: "/assets/img/pepsi-icon.svg",
  },
  {
    value: "emotional",
    label: "Emotional & Deep",
    emoji: "🥺",
    description: "Heartfelt and meaningful",
    icon: "/assets/img/pepsi-icon.svg",
  },
  {
    value: "nostalgic",
    label: "Nostalgic & Reflective",
    emoji: "🌅",
    description: "Memories and reflection",
    icon: "/assets/img/pepsi-icon.svg",
  },
  {
    value: "rebellious",
    label: "Rebellious & Bold",
    emoji: "🔥",
    description: "Edgy and confident",
    icon: "/assets/img/pepsi-icon.svg",
  },
];

const genres = [
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

const songs = [
  {
    label: "Akcent - N-am Bani De Bilet",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Akcent-N-am-Bani-De-Bilet.mp3",
  },
  {
    label: "Alin - Alin",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Alin_-Alin.mp3",
  },
  {
    label: "Anda Adam - Selecta",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Anda%20Adam%20-%20Selecta.mp3",
  },
  {
    label: "Andra feat. Marius Moga - Atata timp cat ma iubesti",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Andra%20feat.%20Marius%20Moga%20-%20Atata%20timp%20cat%20ma%20iubesti.mp3",
  },
  {
    label: "B.U.G. Mafia - Pantelimonu' Petrece (feat. Adriana Vlad)",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/B.U.G.-Mafia-Pantelimonu_-Petrece-_feat.-Adriana-Vlad.mp3",
  },
  {
    label: "Beijo Bla Bla",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Beijo%20Bla%20Bla.mp3",
  },
  {
    label: "Corina - Noi Doi (ft. Pacha Man & Marius Moga)",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Corina%20-%20Noi%20Doi%20(ft.%20Pacha%20Man%20&%20Marius%20Moga).mp3",
  },
  {
    label: "Delia - 1234 (Unde dragoste nu e)",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Delia-1234-_Unde-dragoste-nu-e.mp3",
  },
  {
    label: "DJ Project feat. MIRA - Inima Nebuna",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/DJ%20Project%20feat.%20MIRA%20-%20Inima%20Nebuna.mp3",
  },
  {
    label: "florianrus, MIRA - Strazile din Bucuresti",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/florianrus,%20MIRA%20-%20Strazile%20din%20Bucuresti.mp3",
  },
  {
    label: "Morandi - Beijo Uh La La",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Morandi-Beijo-Uh-La-La.mp3",
  },
  {
    label: "Oficial - Imi merge bine",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Oficial%20imi%20merge%20bine.mp3",
  },
  {
    label: "Shift feat. Marius Moga - Sus Pe Toc",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Shift%20feat.%20Marius%20Moga%20-%20Sus%20Pe%20Toc.mp3",
  },
  {
    label: "Simplu - Oare stii",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Simplu%20-%20Oare%20stii.mp3",
  },
  {
    label: "Smiley feat. Uzzi - In Lipsa Mea",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Smiley%20feat.%20Uzzi%20-%20In%20Lipsa%20Mea.mp3",
  },
  {
    label: "Voltaj - 20",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Voltaj%20-%2020.mp3",
  },
  {
    label: "What's UP - Taxi",
    value:
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/What's%20UP%20-%20Taxi.mp3",
  },
];

const DEFAULT_SONG =
  "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Morandi-Beijo-Uh-La-La.mp3";

export default function InputForm({
  onGenerateLyrics,
  isLoading,
  showPromptOnly = true,
  cachedPrompt = "",
  cachedSong = DEFAULT_SONG,
  cachedMoods = ["upbeat", "romantic"],
  onClear,
}: InputFormProps) {
  const [selectedSong, setSelectedSong] = useState<string>(
    cachedSong || DEFAULT_SONG
  );
  const [prompt, setPrompt] = useState<string>(cachedPrompt);
  const [selectedMoods, setSelectedMoods] = useState<string[]>(
    cachedMoods.length === 2 ? cachedMoods : ["upbeat", "romantic"]
  );
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useState<boolean>(false);
  const [useManualMoods, setUseManualMoods] = useState<boolean>(false);
  const [currentWord, setCurrentWord] = useState(0);

  const animatedWords = ["CREAT", "MAK", "BUILD", "DREAM"];

  // Sync state with cached props when they change (e.g., when user navigates back)
  useEffect(() => {
    setPrompt(cachedPrompt);
    setSelectedSong(cachedSong || DEFAULT_SONG);
    if (cachedMoods.length === 2) {
      setSelectedMoods(cachedMoods);
    }
  }, [cachedPrompt, cachedSong, cachedMoods]);

  // Rotate button words every 2 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % animatedWords.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const isPromptValid = prompt.trim().length > 0;

  // Song-to-mood mapping
  const getSongMoods = (songUrl: string): string[] => {
    // Extract song identifier from URL
    const songMappings: { [key: string]: string[] } = {
      "Akcent-N-am-Bani-De-Bilet": ["upbeat", "rebellious"],
      "Alin_-Alin": ["romantic", "emotional"],
      "Anda%20Adam%20-%20Selecta": ["upbeat", "rebellious"],
      "Andra%20feat.%20Marius%20Moga": ["romantic", "emotional"],
      "B.U.G.-Mafia-Pantelimonu": ["rebellious", "chill"],
      "Beijo%20Bla%20Bla": ["upbeat", "nostalgic"],
      "Voltaj%20-%2020": ["rebellious", "nostalgic"],
    };

    // Find matching song
    for (const [key, moods] of Object.entries(songMappings)) {
      if (songUrl.includes(key)) {
        return moods;
      }
    }

    // Default: randomize 2 moods from available options
    const availableMoods = [
      "upbeat",
      "romantic",
      "chill",
      "emotional",
      "nostalgic",
      "rebellious",
    ];
    const shuffled = [...availableMoods].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  };

  const handleGenerateLyrics = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && isPromptValid) {
      // Always use automatic/randomized moods from getSongMoods
      const finalMoods = getSongMoods(selectedSong);
      onGenerateLyrics(prompt, selectedSong, finalMoods);
    }
  };

  const handleMoodToggle = (moodValue: string) => {
    if (selectedMoods.includes(moodValue)) {
      // Remove mood if already selected
      setSelectedMoods(selectedMoods.filter((m) => m !== moodValue));
    } else {
      // Add mood if not selected, but limit to 2
      if (selectedMoods.length < 2) {
        setSelectedMoods([...selectedMoods, moodValue]);
      } else {
        // Replace the first mood with the new one
        setSelectedMoods([selectedMoods[1], moodValue]);
      }
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleSongChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSong(e.target.value);
  };

  const handleClear = () => {
    setPrompt("");
    setSelectedSong(
      "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/pepsi-songs/Morandi-Beijo-Uh-La-La.mp3"
    );
    setSelectedMoods(["upbeat", "romantic"]);
    if (onClear) {
      onClear();
    }
  };

  return (
    <form
      onSubmit={handleGenerateLyrics}
      className="w-full max-w-3xl mx-auto px-4"
    >
      <div className="bg-white backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-lg border border-ing-accent">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-bold text-ing-dark tracking-tight">
              La ING ești liber să tot fii,<br />
              chiar și creator de melodii!
            </h2>
            <p className="text-ing-text text-base md:text-lg">
              Transformă visul tău în versuri și ascultă noua variantă a piesei.
            </p>
          </div>

          {/* Prompt Input with Overlay Label */}
          <div className="relative group">
            <div className="relative z-10 bg-white rounded-2xl border-2 border-ing-accent p-6 hover:border-ing-orange/40 transition-all duration-300 shadow-sm hover:shadow-md">
              <textarea
                id="prompt"
                value={prompt}
                onChange={handlePromptChange}
                className="w-full min-h-[120px] md:min-h-[160px] text-2xl md:text-3xl font-normal text-ing-text bg-transparent border-none focus:outline-none resize-none leading-relaxed placeholder-transparent z-20 relative"
                required
                disabled={isLoading}
                lang="ro"
                spellCheck="true"
                autoComplete="on"
                autoCorrect="on"
                autoCapitalize="sentences"
                placeholder="scrie-ți visul tău aici"
              />
              {/* Overlay label - only show when empty */}
              {!prompt.trim() && (
                <div className="absolute top-6 left-6 w-full pointer-events-none select-none pr-12">
                  <span className="text-4xl md:text-6xl text-ing-orange font-handwritten transform -rotate-2 inline-block mr-3 font-bold">
                    Sunt liber să
                  </span>
                  <span className="text-gray-400 text-lg md:text-2xl font-light italic">
                    (scrie-ți visul tău aici, oricât de mare, de imposibil, de neînțeles ar fi)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-8">
            <button
              type="submit"
              disabled={isLoading || !prompt.trim() || !isPromptValid}
              className="group relative inline-flex items-center justify-center px-8 py-4 md:px-12 md:py-5 overflow-hidden font-bold text-white transition-all duration-300 bg-ing-dark rounded-full hover:bg-black focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-ing-orange rounded-full group-hover:w-56 group-hover:h-56 opacity-10"></span>
              <div className="relative flex items-center text-xl md:text-2xl uppercase tracking-wider">
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="spinner w-6 h-6"></div>
                    <span>LOADING</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div className="h-[30px] md:h-[36px] overflow-hidden w-[100px] md:w-[120px] text-right relative">
                      {animatedWords.map((word, index) => (
                        <span
                          key={word}
                          className={`absolute right-0 block transition-all duration-500 ${
                            index === currentWord
                              ? "opacity-100 translate-y-0"
                              : index < currentWord
                              ? "opacity-0 -translate-y-full"
                              : "opacity-0 translate-y-full"
                          }`}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                    <span className="text-ing-orange ml-0.5">ING</span>
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
