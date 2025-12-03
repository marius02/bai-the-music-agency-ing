"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InputForm from "./components/InputForm";
import Loader from "./components/Loader";
import PreviewPlayer from "./components/PreviewPlayer";
import TrackGrid from "./components/TrackGrid";
import LyricsSelectionWithForm from "./components/LyricsSelectionWithForm";
import StepIndicator from "./components/StepIndicator";
import { containsProfanitySync } from "./lib/profanity-filter";
import { pollJobUntilComplete } from "./lib/poll-job"; // Only used for music generation queue

// Rate limiting helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry helper with exponential backoff for rate limits
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If rate limited (429), wait and retry
      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get("Retry-After") || "10"
        );
        const waitTime = Math.min(retryAfter * 1000, 10000); // Max 10s

        console.warn(
          `⚠️  Rate limited (attempt ${attempt + 1}/${maxRetries}). Waiting ${
            waitTime / 1000
          }s...`
        );
        await sleep(waitTime);
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff: 1s, 2s, 4s
      const backoffTime = Math.pow(2, attempt) * 1000;
      console.warn(
        `⚠️  Request failed (attempt ${
          attempt + 1
        }/${maxRetries}). Retrying in ${backoffTime / 1000}s...`
      );
      await sleep(backoffTime);
    }
  }

  throw new Error("Max retries reached");
}

// Mood to BPM mapping - must match the one in LyricsSelectionWithForm
const moodToBPM: Record<"sad" | "chill" | "creative" | "hype", string> = {
  sad: "60-80 BPM",
  chill: "80-100 BPM",
  creative: "100-120 BPM",
  hype: "120-140 BPM",
};

interface FormData {
  selectedSong: string;
  prompt: string;
  genre: string;
  vocalType: "male" | "female" | "instrumental";
}

interface Track {
  id: string;
  title: string;
  genre: string;
  audioUrl: string; // Full quality download URL (available after ~2-5 min)
  streamUrl?: string; // Stream preview URL (available after ~20-30s)
  imageUrl?: string;
  duration?: string;
  lyrics?: string;
  vocalType?: string;
  mood?: string;
  isStreaming?: boolean; // Track is currently streaming (preview mode)
  isUpgrading?: boolean; // Track is being upgraded from stream to full quality
}

interface LyricsOption {
  text: string;
  title: string;
  status: string;
  errorMessage?: string;
}

type AppState =
  | "input"
  | "lyrics-selection"
  | "loading"
  | "preview-playing"
  | "results";

// Sanitize error messages for user display
function getUserFriendlyError(error: string): string {
  const errorLower = error.toLowerCase();
  
  // Map technical errors to user-friendly messages
  if (errorLower.includes('uploaded audio matches existing work')) {
    return "Too many generations right now. Please wait a moment and try again.";
  }
  
  if (errorLower.includes('rate limit') || errorLower.includes('too many requests')) {
    return "Too many generations right now. Please wait a moment and try again.";
  }
  
  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    return "Generation took too long. Please try again.";
  }
  
  if (errorLower.includes('api') || errorLower.includes('server')) {
    return "Our music service is temporarily unavailable. Please try again in a few moments.";
  }
  
  if (errorLower.includes('failed after') || errorLower.includes('multiple attempts')) {
    return "We couldn't complete your music after multiple attempts. Please try a fresh generation.";
  }
  
  // Default: return original if it's already user-friendly (short and clear)
  if (error.length < 100) {
    return error;
  }
  
  // Generic fallback for long technical errors
  return "Something went wrong. Please try again or use a different story.";
}

// Extract song name from URL
// Example: "https://.../Morandi-Beijo-Uh-La-La.mp3" -> "Morandi - Beijo Uh La La"
function extractSongNameFromUrl(url: string): string {
  try {
    // Get the filename from the URL
    const parts = url.split("/");
    const filename = parts[parts.length - 1];

    // Remove file extension
    const nameWithoutExt = filename.replace(/\.(mp3|wav)$/i, "");

    // Decode URL encoding
    const decoded = decodeURIComponent(nameWithoutExt);

    // Replace hyphens and underscores with spaces
    const withSpaces = decoded.replace(/[-_]/g, " ");

    // Clean up multiple spaces
    const cleaned = withSpaces.replace(/\s+/g, " ").trim();

    return cleaned;
  } catch (error) {
    console.error("Error extracting song name:", error);
    return "Song";
  }
}

// Simple language detection function
// Detects Romanian by checking for Romanian-specific characters and common words
function detectLanguage(text: string): string {
  // Romanian specific characters: ă â î ș ț (and uppercase variants)
  const romanianChars = /[ăâîșțĂÂÎȘȚ]/;

  // Common Romanian words
  const romanianWords =
    /\b(și|cu|de|la|în|pe|din|pentru|ca|sunt|este|am|ce|mai|pe|cum|dacă|după|despre|până|foarte|bine|când|unde|aici|acolo|aș|să|nu|eu|tu|el|ea|noi|voi|ei|ele)\b/i;

  // Check for Romanian-specific characters
  if (romanianChars.test(text)) {
    return "ro";
  }

  // Check for Romanian words (at least 2 matches to be more certain)
  const matches = text.match(new RegExp(romanianWords, "gi"));
  if (matches && matches.length >= 2) {
    return "ro";
  }

  // Default to English
  return "en";
}

export default function Home() {
  const [state, setState] = useState<AppState>("input");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [currentSong, setCurrentSong] = useState<string>("");
  const [currentMoods, setCurrentMoods] = useState<string[]>([]);
  const [lyricsOptions, setLyricsOptions] = useState<LyricsOption[]>([]);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const [hasSelectedLyrics, setHasSelectedLyrics] = useState<boolean>(false);
  const [queueStatus, setQueueStatus] = useState<{
    position?: number;
    estimatedWait?: number;
    message?: string;
    attempts?: number;
    maxRetries?: number;
  }>({});
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const router = useRouter();

  const steps = ["Your Story", "Choose Lyrics", "Music Style", "Your Song"];

  const getCurrentStep = () => {
    switch (state) {
      case "input":
        return 1;
      case "lyrics-selection":
        return hasSelectedLyrics ? 3 : 2;
      case "loading":
      case "preview-playing":
      case "results":
        return 4;
      default:
        return 1;
    }
  };

  // Function to inject ING locked chorus into generated lyrics
  const injectINGChorus = (generatedLyrics: string): string => {
    const lockedChorus = `[Chorus]
Fac ce vreau, nu-mi pasă
E viața mea, hai lasă
Că fac ce vreau, ești culmea
Și ce-o să zică lumea
Fac ce vreau, nu-mi pasă
E viața mea, hai lasă
Că fac ce vreau, ești culmea
Și ce-o să zică lumea`;

    // Find and replace the first [Chorus] section with our locked chorus
    const chorusRegex = /\[Chorus\]([\s\S]*?)(?=\[|$)/i;
    
    if (chorusRegex.test(generatedLyrics)) {
      // Replace existing chorus with locked chorus
      return generatedLyrics.replace(chorusRegex, lockedChorus + '\n\n');
    } else {
      // If no chorus found, insert after first verse
      const verseRegex = /(\[Verse[^\]]*\][\s\S]*?)(?=\[|$)/i;
      if (verseRegex.test(generatedLyrics)) {
        return generatedLyrics.replace(verseRegex, `$1\n${lockedChorus}\n\n`);
      }
    }
    
    // Fallback: prepend chorus if structure unclear
    return `${lockedChorus}\n\n${generatedLyrics}`;
  };

  // Save active job to localStorage for recovery after page refresh
  const saveActiveJob = (jobId: string, jobData: any) => {
    try {
      localStorage.setItem('ing_active_job', JSON.stringify({
        jobId,
        ...jobData,
        savedAt: Date.now(),
      }));
      setActiveJobId(jobId);
      console.log(`💾 Saved job ${jobId} to localStorage for recovery`);
    } catch (err) {
      console.error('Failed to save active job:', err);
    }
  };

  // Clear active job from localStorage
  const clearActiveJob = () => {
    try {
      localStorage.removeItem('ing_active_job');
      setActiveJobId(null);
      console.log(`🗑️ Cleared active job from localStorage`);
    } catch (err) {
      console.error('Failed to clear active job:', err);
    }
  };

  // Recover active job on page load
  const recoverActiveJob = async () => {
    try {
      const savedJob = localStorage.getItem('ing_active_job');
      if (!savedJob) return;

      const job = JSON.parse(savedJob);
      const ageMinutes = (Date.now() - job.savedAt) / 1000 / 60;

      // Only recover jobs less than 10 minutes old
      if (ageMinutes > 10) {
        console.log(`⏰ Saved job is ${ageMinutes.toFixed(1)} minutes old, skipping recovery`);
        clearActiveJob();
        return;
      }

      console.log(`🔄 Recovering job ${job.jobId} (${ageMinutes.toFixed(1)} min old)`);
      setActiveJobId(job.jobId);
      setState('loading');

      // Poll for job completion
      const { pollJobWithProgress } = await import("./lib/poll-job");
      
      const result = await pollJobWithProgress(
        job.jobId,
        (status) => {
          setQueueStatus({
            position: status.queuePosition,
            estimatedWait: status.estimatedWaitSeconds,
            message: status.message,
            attempts: status.attempts,
            maxRetries: status.maxRetries,
          });
        },
        120, // 4 minutes max for recovery
        2000
      );

      if (result && result.taskId) {
        console.log(`✅ Job recovered! TaskId: ${result.taskId}`);
        // Continue with normal Suno polling
        // ... (implement based on your existing flow)
        clearActiveJob();
      }
    } catch (err) {
      console.error('Failed to recover job:', err);
      clearActiveJob();
      setState('input');
    }
  };

  // Check for active jobs on page load
  useEffect(() => {
    recoverActiveJob();
  }, []);

  const handleGenerateLyrics = async (
    prompt: string,
    selectedSong: string,
    moods: string[]
  ) => {
    const startTime = Date.now();
    console.log(`\n🚀 === STARTING LYRICS GENERATION ===`);
    console.log(`⏰ Time: ${new Date(startTime).toLocaleTimeString()}`);
    console.log(
      `📝 User story: "${prompt.substring(0, 100)}${
        prompt.length > 100 ? "..." : ""
      }"`
    );

    console.log(`🎵 Using ING base track: Fac Ce vreau`);
    console.log(`🎭 Moods: ${moods.join(", ")}`);

    // Step 0: Quick client-side profanity check (fallback only)
    console.log(`\n🛡️ === CLIENT-SIDE PROFANITY FILTER CHECK ===`);
    if (containsProfanitySync(prompt)) {
      console.error(`❌ Profanity detected in user input (client-side)`);
      setError("Te rugăm să eviți limbajul vulgar în descrierea ta.");
      setIsGeneratingLyrics(false);
      return;
    }
    console.log(`✅ Input passed client-side profanity filter`);

    // Save prompt, song, and moods for later
    setCurrentPrompt(prompt);
    setCurrentSong(selectedSong);
    setCurrentMoods(moods);
    setIsGeneratingLyrics(true);
    setError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_SUNO_API_KEY;

      if (!apiKey) {
        throw new Error(
          "API key is not configured. Please set NEXT_PUBLIC_SUNO_API_KEY in your .env.local file."
        );
      }

      const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

      // Step 1: Summarize the story using GPT (optimized settings)
      console.log(`\n🤖 === CALLING GPT SUMMARIZATION API ===`);
      console.log(`📝 Original story length: ${prompt.length} characters`);

      const summarizeStartTime = Date.now();
      const summarizeResponse = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          story: prompt,
          moods: moods,
        }),
      });

      if (!summarizeResponse.ok) {
        const errorData = await summarizeResponse.json();
        throw new Error(errorData.error || "Failed to summarize story");
      }

      const { summary } = await summarizeResponse.json();
      const summarizeTime = ((Date.now() - summarizeStartTime) / 1000).toFixed(1);
      console.log(`✅ GPT Summarization complete in ${summarizeTime}s`);
      console.log(`📝 Summarized story: "${summary}" (${summary.length} chars)`);

      // Verify GPT output doesn't contain profanity (handled server-side)
      console.log(`✅ GPT summary received and verified by server`);

      // Extract and log potential names to verify preservation
      const potentialNames = summary.match(
        /\b[A-ZĂÂÎȘȚa-zăâîșț][a-zăâîșț]+(?:\s[A-ZĂÂÎȘȚa-zăâîșț][a-zăâîșț]+)*/g
      );
      if (potentialNames && potentialNames.length > 0) {
        console.log(`� Names/Places preserved: ${potentialNames.join(", ")}`);
      }

      // Detect language from both original prompt AND GPT summary (more accurate)
      const detectedLanguage = detectLanguage(prompt + " " + summary);
      console.log(`\n🌍 Language detected: ${detectedLanguage.toUpperCase()}`);

      // Create mood-specific prompts
      const moodDescriptions: Record<string, string> = {
        upbeat: "upbeat energetic",
        romantic: "romantic sweet",
        chill: "chill relaxed",
        emotional: "emotional deep",
        nostalgic: "nostalgic reflective",
        rebellious: "rebellious bold",
      };

      console.log(`\n🎭 === GENERATING LYRICS FOR ${moods.length} MOODS ===`);

      // Generate 2 lyrics variations with different moods using the summarized story
      const lyricsStartTime = Date.now();
      const lyricsPromises = moods.map((mood, index) => {
        console.log(`\n🎵 Generating lyrics ${index + 1}/${moods.length}: ${mood} mood`);

        return fetch("/api/generate-lyrics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: summary,
            mood: mood,
            language: detectedLanguage,
          }),
        });
      });

      const responses = await Promise.all(lyricsPromises);

      console.log(`\n📥 Received ${responses.length} API responses`);

      // Check if all responses are ok
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          const errorData = await responses[i].json();
          console.error(`❌ Lyrics API Error for mood ${moods[i]}:`, errorData);
          throw new Error(
            errorData.error || `Lyrics generation failed: ${responses[i].status}`
          );
        }
      }

      // Parse responses and extract lyrics
      const lyricsData = await Promise.all(
        responses.map((r) => r.json())
      );

      console.log(`\n✅ Generated ${lyricsData.length} lyrics variations`);
      
      // Process lyrics and inject ING chorus
      const combinedLyrics: LyricsOption[] = lyricsData.map((data, index) => {
        const lyricsText = data.lyrics || '';
        
        // Inject ING locked chorus into the generated lyrics
        const lyricsWithINGChorus = injectINGChorus(lyricsText);
        console.log(`🎤 Injected ING locked chorus into ${moods[index]} lyrics`);
        console.log(`   Original length: ${lyricsText.length} chars`);
        console.log(`   With chorus: ${lyricsWithINGChorus.length} chars`);
        
        return {
          text: lyricsWithINGChorus,
          title: `${moods[index].charAt(0).toUpperCase() + moods[index].slice(1)} Version`,
          status: 'complete',
        };
      });

      const lyricsTime = ((Date.now() - lyricsStartTime) / 1000).toFixed(1);
      console.log(`✅ All lyrics generated in ${lyricsTime}s`);
      
      // Update state with lyrics options
      setState("lyrics-selection");
      setLyricsOptions(combinedLyrics);

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ === ALL LYRICS GENERATION COMPLETE ===`);
      console.log(`⏱️  Total time: ${totalTime}s`);
      console.log(`📝 Generated ${combinedLyrics.length} lyrics options`);

      setIsGeneratingLyrics(false);

      if (combinedLyrics.length === 0) {
        throw new Error("No lyrics were generated");
      }
    } catch (err) {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n❌ === LYRICS GENERATION FAILED (${totalTime}s) ===`);
      console.error("Error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setIsGeneratingLyrics(false);
    }
  };

  // Helper function to process and display tracks
  const processAndDisplayTracks = (
    trackData: any[],
    musicData: {
      genre: string;
      vocalType: "male" | "female" | "duet";
      title?: string;
      remixedBy?: string;
      mood: "sad" | "chill" | "creative" | "hype";
    },
    lyrics: string
  ) => {
    console.log(`\n🎵 === PROCESSING ${trackData.length} TRACKS ===`);

    const generatedTracks: Track[] = trackData.map(
      (item: any, index: number) => {
        // Get base title from API response
        let trackTitle = item.title || `ING Music Track ${index + 1}`;

        // Prepend @handle if provided
        if (musicData.remixedBy?.trim()) {
          const handle = musicData.remixedBy.trim();
          trackTitle = `${handle} - ${trackTitle}`;
          console.log(`👤 Prepending handle to title: "${trackTitle}"`);
        }

        return {
          id: item.id || `track-${index}`,
          title: trackTitle,
          genre: musicData.genre,
          audioUrl: item.audioUrl || item.audio_url || "",
          streamUrl: item.streamUrl,
          imageUrl: item.imageUrl || item.image_url,
          isStreaming: item.isStreaming || false,
          isUpgrading: item.isUpgrading || false,
          duration:
            item.duration && !isNaN(item.duration)
              ? `${Math.floor(item.duration / 60)}:${Math.floor(
                  item.duration % 60
                )
                  .toString()
                  .padStart(2, "0")}`
              : undefined,
          lyrics: lyrics,
          vocalType: musicData.vocalType,
          mood: musicData.mood,
        };
      }
    );

    // Save to localStorage
    try {
      console.log(`\n💾 === SAVING TO LOCALSTORAGE ===`);

      const existingTracks = localStorage.getItem("ing_generated_tracks");
      const allTracks: Track[] = existingTracks
        ? JSON.parse(existingTracks)
        : [];

      // Update existing tracks or add new ones
      const updatedTracks = [...allTracks];

      generatedTracks.forEach((newTrack) => {
        const existingIndex = updatedTracks.findIndex(
          (t) => t.id === newTrack.id
        );
        if (existingIndex >= 0) {
          // Update existing track (e.g., upgrade from preview to full quality)
          updatedTracks[existingIndex] = newTrack;
          console.log(
            `🔄 Updated track: ${newTrack.title} (isStreaming: ${newTrack.isStreaming}, isUpgrading: ${newTrack.isUpgrading})`
          );
        } else {
          // Add new track
          updatedTracks.unshift(newTrack);
          console.log(`➕ Added new track: ${newTrack.title}`);
        }
      });

      localStorage.setItem(
        "ing_generated_tracks",
        JSON.stringify(updatedTracks)
      );

      console.log(
        `✅ Saved ${generatedTracks.length} tracks (${updatedTracks.length} total in storage)`
      );
    } catch (err) {
      console.error("❌ Failed to save to localStorage:", err);
    }

    // Update state immediately
    setTracks(generatedTracks);
    setState("results");

    console.log(`\n✅ === UI UPDATED ===`);
    console.log(`🎵 Displaying ${generatedTracks.length} tracks to user`);
  };

  const handleMusicGeneration = async (
    lyrics: string,
    musicData: {
      genre: string;
      vocalType: "male" | "female" | "duet";
      title?: string;
      remixedBy?: string;
      mood: "sad" | "chill" | "creative" | "hype";
    }
  ) => {
    const startTime = Date.now();
    console.log(`\n🎵 === STARTING MUSIC GENERATION ===`);
    console.log(`⏰ Time: ${new Date(startTime).toLocaleTimeString()}`);
    console.log(`📝 Lyrics length: ${lyrics.length} characters`);

    console.log(`🎸 Genre: ${musicData.genre}`);
    console.log(`🎤 Vocal: ${musicData.vocalType}`);
    console.log(
      `🎭 Mood/BPM: ${musicData.mood} (${moodToBPM[musicData.mood]})`
    );

    setState("loading");
    setError(null);
    setQueueStatus({}); // Clear previous queue status

    try {
      // Detect language and add Romanian diacritics if needed
      const detectedLanguage = detectLanguage(lyrics);
      console.log(
        `\n🌍 Detected lyrics language: ${detectedLanguage.toUpperCase()}`
      );

      let processedLyrics = lyrics;
      if (detectedLanguage === "ro") {
        console.log(`📝 Adding Romanian diacritics to lyrics...`);
        try {
          const diacriticsResponse = await fetch("/api/add-diacritics", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lyrics: lyrics,
              language: detectedLanguage,
            }),
          });

          if (diacriticsResponse.ok) {
            const { lyrics: correctedLyrics } = await diacriticsResponse.json();
            processedLyrics = correctedLyrics;
            console.log(`✅ Diacritics added successfully`);
            console.log(
              `\n📄 FINAL LYRICS (with diacritics):\n${processedLyrics}\n`
            );
          } else {
            console.warn(`⚠️ Failed to add diacritics, using original lyrics`);
          }
        } catch (diacriticsError) {
          console.warn(`⚠️ Error adding diacritics:`, diacriticsError);
          console.log(`📝 Continuing with original lyrics`);
        }
      } else {
        console.log(`\n📄 FINAL LYRICS (English):\n${processedLyrics}\n`);
      }

      const apiKey = process.env.NEXT_PUBLIC_SUNO_API_KEY;

      if (!apiKey) {
        throw new Error(
          "API key is not configured. Please set NEXT_PUBLIC_SUNO_API_KEY in your .env.local file."
        );
      }

      // Generate title if not provided
      let songTitle = musicData.title?.trim();
      if (!songTitle) {
        // Auto-generate title: "ING [GENRE] REMIX"
        // Note: @handle will be prepended when displaying tracks
        songTitle = `ING ${musicData.genre.toUpperCase()} REMIX`;
      }
      // If user provided a custom title, use it as-is

      console.log(`\n🏷️  Song title (sent to API): "${songTitle}"`);
      if (musicData.title?.trim()) {
        console.log(`✏️  Custom title provided by user`);
      }
      if (musicData.remixedBy?.trim()) {
        console.log(
          `👤 Will prepend handle when displaying: ${musicData.remixedBy.trim()}`
        );
      }

      // Prepare the request body
      // Get the callback URL - use Vercel URL in production, localhost in dev
      const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

      // Use fixed ING audio URL for all songs
      const audioUploadUrl = "https://cawkcwwomiojueeicqot.supabase.co/storage/v1/object/public/Songs/ing/Ing%20-%20Fac%20Ce%20vreau.mp3";

      // Always use upload-cover endpoint with the fixed ING audio
      const endpoint = "https://api.sunoapi.org/api/v1/generate/upload-cover";

      console.log(
        `\n📍 API Endpoint: Cover/Remix Mode (ING Base Track)`
      );
      console.log(`🎵 Reference audio: ${audioUploadUrl}`);

      // Use detected language from earlier (already logged)
      const languageHint = detectedLanguage === "ro" ? "Romanian language" : "";
      if (languageHint) {
        console.log(`📝 Adding language hint to style: "${languageHint}"`);
      }

      // Get detailed style description based on song and genre
      const getDetailedStyle = (
        songUrl: string,
        genre: string,
        mood: string
      ): string => {
        const bpmHint =
          moodToBPM[mood as keyof typeof moodToBPM] || "100-120 BPM";

        const vocalDesc =
          musicData.vocalType === "male"
            ? "male"
            : musicData.vocalType === "female"
            ? "female"
            : "male and female";

        // Map genre names to style keys (normalize variations)
        const genreMap: { [key: string]: string } = {
          "⭐ Original": "Original",
          "Hip Hop": "Hip Hop",
          "Pop Rock": "Pop Rock",
          "Electronic Dance": "Retro-Disco",
          House: "Tech-House",
          "Upbeat Pop": "Original",
          "R&B Soul": "Original",
          Acoustic: "Original",
          Jazz: "Original",
          "Indie Pop": "Original",
          "Latin Pop": "Original",
          Funk: "Original",
          Reggae: "Original",
          "Chill Vibes": "Original",
          Rock: "Pop Rock",
          Ambient: "Original",
        };

        const styleKey = genreMap[genre] || "Original";

        // Song-specific detailed style descriptions with genre variations (max 1000 chars for V5)
        const styleDescriptions: {
          [songKey: string]: { [genreKey: string]: string };
        } = {
          Akcent: {
            Original: `A Romanian dance-pop track with a driving beat and a ${vocalDesc} vocalist. The song features a prominent synth melody, a consistent kick drum, and a bassline that provides a strong rhythmic foundation. The vocal delivery is energetic and slightly processed, with some spoken word elements. The song structure includes verses and a chorus, with instrumental breaks that highlight the synth melody. The tempo is ${bpmHint}. The overall production is clean and modern, with a focus on danceability. The key appears to be minor, contributing to a slightly melancholic yet energetic feel. The mixing emphasizes the vocals and the main synth line, with other instruments providing support. ${languageHint}`,
            "Hip Hop": `A trap or hip-hop production with a ${vocalDesc} vocalist delivering rhythmic verses over hard-hitting 808 basslines and crisp hi-hats. The tempo is ${bpmHint}. Features pitched vocal samples, atmospheric pads, and a punchy snare pattern. The vocal delivery includes rap verses with melodic hooks. Modern urban production with sidechain compression and layered vocal ad-libs. ${languageHint}`,
            "Retro-Disco": `A 70s/80s disco production with a ${vocalDesc} vocalist, featuring a four-on-the-floor kick drum, funky bass guitar, rhythmic guitar strumming, and lush string arrangements. The tempo is ${bpmHint}. Classic disco elements include handclaps, open hi-hats on off-beats, and soaring vocal harmonies. Vintage analog synth sounds with warm, punchy mixing reminiscent of Studio 54 era. ${languageHint}`,
            "Pop Rock": `A 90s-style pop-rock or light punk rock production with a ${vocalDesc} vocalist delivering powerful vocal lines. The tempo is ${bpmHint}. Features distorted electric guitars, driving basslines, energetic drum patterns with crashes, and acoustic guitar layers. Anthemic choruses with gang vocals and melodic verses. Production balances raw rock energy with pop accessibility. ${languageHint}`,
            "Tech-House": `A tech house, afrohouse, or Berlin minimal techno production with a ${vocalDesc} vocalist. The tempo is ${bpmHint}. Features a driving four-on-the-floor kick, rolling basslines, crisp percussion loops, and minimal synth stabs. Hypnotic groove with subtle filter sweeps and atmospheric pads. Clean, spacious mixing with focus on rhythm and groove. ${languageHint}`,
          },
          Morandi: {
            Original: `A Latin pop track with a driving reggaeton rhythm, featuring a ${vocalDesc} vocalist. The song is in a minor key, with a tempo of ${bpmHint}. The instrumentation includes a prominent synth bass providing a deep, resonant foundation, a drum machine with a classic reggaeton beat, and a synth pad creating atmospheric textures. A synth lead plays a simple, catchy melody. The vocals are delivered with a clear, slightly breathy tone, utilizing some autotune for a polished sound. The song structure follows a typical verse-chorus format, with an instrumental intro and outro. Production elements include a clean mix with a focus on the rhythmic elements and a reverb effect on the vocals. ${languageHint}`,
            "Hip Hop": `A Latin trap production with a ${vocalDesc} vocalist blending reggaeton rhythms with modern hip-hop elements. The tempo is ${bpmHint}. Features dembow beat patterns, rolling 808s, crisp hi-hats, and atmospheric synth pads. Vocal delivery combines melodic singing with rhythmic rap flows. Modern production includes autotune, vocal chops, and tropical percussion elements. Clean mix with punchy low-end and spacious reverb. ${languageHint}`,
            "Retro-Disco": `A Latin disco fusion with a ${vocalDesc} vocalist, blending 70s/80s disco with tropical rhythms. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar with Latin flavor, congas and bongos, lush string sections, and rhythmic guitar. Classic disco production with warm analog synths, soaring vocal harmonies, and handclaps. Vibrant, celebratory energy reminiscent of Studio 54 meets Copacabana. ${languageHint}`,
            "Pop Rock": `A Latin pop-rock track with a ${vocalDesc} vocalist delivering passionate vocals. The tempo is ${bpmHint}. Features clean electric guitars with Latin chord progressions, driving bass guitar, energetic drums with Latin percussion accents, and acoustic guitar layers. Anthemic choruses with powerful vocal harmonies and melodic verses. Production balances rock instrumentation with Latin pop accessibility and romantic energy. ${languageHint}`,
            "Tech-House": `A Latin tech house production with a ${vocalDesc} vocalist, blending minimal techno with tropical house elements. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, deep rolling bassline, crisp percussion with Latin flavor (shakers, claves), and minimal synth stabs. Hypnotic groove with subtle filter sweeps, tropical atmospheres, and vocal chops. Clean, spacious mix perfect for beach clubs and festival sets. ${languageHint}`,
          },
          Voltaj: {
            Original: `A high-energy electronic dance track with a driving beat and a prominent synth melody. The song features a ${vocalDesc} vocalist delivering rap-like verses and a catchy, anthemic chorus. The instrumentation includes a strong kick drum, a pulsating bassline, various synthesized pads and leads, and occasional percussive elements. The tempo is ${bpmHint}, creating a sense of urgency and excitement. The mix is clean and powerful, with the vocals sitting clearly above the instrumental. The song structure follows a typical verse-chorus format with an instrumental break. The melody is repetitive and memorable, designed for a dancefloor environment. ${languageHint}`,
            "Hip Hop": `A high-energy hip-hop track with a ${vocalDesc} vocalist delivering rapid-fire verses over aggressive trap beats. The tempo is ${bpmHint}. Features hard-hitting 808 basslines, crisp snare rolls, rapid hi-hats, and atmospheric synth pads. Vocal delivery combines anthemic sung choruses with aggressive rap verses. Modern production with heavy sidechain compression, vocal ad-libs, and impactful drops. Built for hype moments and club energy. ${languageHint}`,
            "Retro-Disco": `A high-energy disco-funk production with a ${vocalDesc} vocalist delivering energetic vocals over a driving groove. The tempo is ${bpmHint}. Features four-on-the-floor kick, slap bass guitar, funky rhythm guitar, lush string arrangements, and vintage synth leads. Classic disco elements include handclaps, open hi-hats, soaring vocal harmonies, and dynamic breakdowns. Warm analog production reminiscent of late 70s/early 80s dance floor anthems. ${languageHint}`,
            "Pop Rock": `A high-energy pop-rock anthem with a ${vocalDesc} vocalist delivering powerful, anthemic vocals. The tempo is ${bpmHint}. Features distorted power chords, driving bass guitar, energetic drum patterns with crashes and fills, and layered electric guitars. Explosive choruses with gang vocals and memorable melodic hooks. Production combines stadium rock energy with modern pop production values. Built for sing-alongs and festival crowds. ${languageHint}`,
            "Tech-House": `A high-energy tech house production with a ${vocalDesc} vocalist delivering anthemic vocal hooks. The tempo is ${bpmHint}. Features pounding four-on-the-floor kick, rolling bassline, crisp percussion loops, and sharp synth stabs. Hypnotic groove with filter sweeps, build-ups, and explosive drops. Modern production with vocal chops, sidechain compression, and festival-ready energy. Clean, powerful mix designed for peak-time dancefloor moments. ${languageHint}`,
          },
          "B.U.G": {
            Original: `A Romanian hip-hop track featuring a ${vocalDesc} vocalist with a deep, slightly raspy voice, delivering rap verses over a driving beat. The tempo is ${bpmHint}. The instrumentation includes a prominent synth bass line, a consistent drum machine beat with a strong kick and snare, and a high-pitched synth melody that provides a catchy, almost playful counterpoint to the rap. The song is in a minor key, contributing to a somewhat dark yet energetic atmosphere, maintaining a consistent rhythm throughout. Production elements include a clear mix with the vocals upfront, and a slight reverb on the vocals. The song structure alternates between rap verses and a melodic chorus featuring a female vocalist. The female vocals are clean and melodic, contrasting with the male rap. There are also ad-libs and spoken interjections throughout the track. The overall feel is energetic and suitable for a party or club setting. ${languageHint}`,
            "Hip Hop": `A Romanian trap production with a ${vocalDesc} vocalist delivering aggressive rap flows over modern hip-hop beats. The tempo is ${bpmHint}. Features heavy 808 basslines, snappy snares, rapid hi-hat rolls, and dark atmospheric pads. Vocal delivery is raw and energetic with ad-libs, doubles, and vocal effects. Modern production with hard-hitting drums, melodic synth loops, and gritty underground energy. Built for street credibility and club bangers. ${languageHint}`,
            "Retro-Disco": `A Romanian disco-rap fusion with a ${vocalDesc} vocalist blending old-school rap delivery with 70s/80s disco grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar, vintage synth strings, and disco percussion. Rap verses over disco instrumental with melodic sung chorus. Playful production mixing classic disco warmth with hip-hop swagger. Unique blend of Bucharest street style with Studio 54 energy. ${languageHint}`,
            "Pop Rock": `A Romanian rap-rock track with a ${vocalDesc} vocalist delivering powerful rap verses over rock instrumentation. The tempo is ${bpmHint}. Features distorted electric guitars, heavy bass guitar, energetic drum patterns with double kicks, and guitar riffs. Aggressive rap delivery with anthemic rock choruses. Production combines raw rock energy with hip-hop attitude. Rebellious spirit with mosh-pit ready intensity. ${languageHint}`,
            "Tech-House": `A Romanian tech house track with a ${vocalDesc} vocalist delivering rhythmic rap flows over minimal techno beats. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, deep rolling bassline, crisp minimal percussion, and dark synth stabs. Hypnotic groove with rap verses processed as rhythmic elements. Underground club production with raw vocal energy over stripped-back techno foundation. Perfect for late-night warehouse parties. ${languageHint}`,
          },
          Alin: {
            Original: `A high-energy dance track with a driving beat and a ${vocalDesc} vocalist. The tempo is ${bpmHint}. The song features a prominent synth bassline, a consistent kick drum, and a snare drum with a short, punchy decay. A high-pitched synth melody plays throughout, often in unison with the bassline or as a counter-melody. The vocal delivery is rhythmic and spoken-word influenced, with a call-and-response structure in the chorus. The overall feel is energetic and danceable. The production is clean with a focus on rhythmic clarity and a bright, forward mix for the vocals and lead synth. ${languageHint}`,
            "Hip Hop": `A Romanian pop-trap fusion with a ${vocalDesc} vocalist blending melodic pop singing with modern hip-hop beats. The tempo is ${bpmHint}. Features rolling 808s, crisp hi-hats, trap snares, and atmospheric synth pads. Vocal delivery combines catchy sung hooks with rhythmic rap-influenced verses. Modern urban production with autotune touches, vocal layers, and punchy low-end. Fresh Romanian pop with street edge. ${languageHint}`,
            "Retro-Disco": `A Romanian disco-pop production with a ${vocalDesc} vocalist delivering upbeat vocals over 70s/80s inspired grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar strums, lush string sections, and vintage synth leads. Classic disco elements with handclaps, soaring harmonies, and infectious dance energy. Warm analog production with Romanian pop sensibility. ${languageHint}`,
            "Pop Rock": `A Romanian pop-rock track with a ${vocalDesc} vocalist delivering energetic vocals over rock instrumentation. The tempo is ${bpmHint}. Features clean electric guitars, driving bass, energetic drums with crashes, and acoustic guitar layers. Catchy choruses with melodic hooks and upbeat verses. Production balances rock energy with pop accessibility and radio-friendly appeal. ${languageHint}`,
            "Tech-House": `A Romanian tech house production with a ${vocalDesc} vocalist delivering catchy vocal hooks over minimal techno beats. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, rolling bassline, crisp percussion loops, and minimal synth stabs. Hypnotic groove with vocal chops, filter sweeps, and club-ready energy. Modern dance production with Romanian pop flavor. ${languageHint}`,
          },
          Anda: {
            Original: `A high-energy dance track with a driving beat and a blend of electronic and acoustic elements. The song features a prominent ${vocalDesc} vocalist with a clear, confident tone, often layered with harmonies. The tempo is ${bpmHint}. The instrumentation includes a strong, rhythmic bassline, a consistent drum beat with a focus on kick and snare, and various synth elements providing melodic and atmospheric textures. There are also percussive elements that sound like shakers and claps. The song structure is verse-chorus, with a clear build-up in energy towards the chorus. The overall mood is celebratory and danceable. Production includes reverb on vocals and some synth elements, creating a spacious feel. The mix is clean, with vocals prominent in the foreground. ${languageHint}`,
            "Hip Hop": `A Romanian dance-trap fusion with a ${vocalDesc} vocalist combining powerful vocals with modern hip-hop beats. The tempo is ${bpmHint}. Features heavy 808 basslines, trap hi-hats, snappy snares, and atmospheric pads. Vocal delivery blends confident singing with rhythmic rap flows. Modern production with vocal effects, hard-hitting drums, and bold energy. Dance floor meets street style. ${languageHint}`,
            "Retro-Disco": `A Romanian disco-dance production with a ${vocalDesc} vocalist delivering energetic vocals over 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar, lush strings, and vintage synth sounds. Classic disco production with handclaps, soaring harmonies, and infectious dance energy. Studio 54 vibes with Romanian flair. ${languageHint}`,
            "Pop Rock": `A Romanian dance-rock track with a ${vocalDesc} vocalist delivering powerful vocals over rock-influenced instrumentation. The tempo is ${bpmHint}. Features electric guitars, driving bass, energetic drums, and synth elements. Anthemic choruses with dance-rock energy and memorable hooks. Production combines rock attitude with dance accessibility. ${languageHint}`,
            "Tech-House": `A Romanian tech house track with a ${vocalDesc} vocalist delivering commanding vocal hooks over minimal techno grooves. The tempo is ${bpmHint}. Features pounding four-on-the-floor kick, deep rolling bassline, crisp percussion, and sharp synth stabs. Hypnotic groove with vocal processing, filter sweeps, and peak-time club energy. Modern dance production built for main rooms. ${languageHint}`,
          },
          Andra: {
            Original: `A high-energy dance-pop track with a driving beat and a strong ${vocalDesc} vocalist. The tempo is ${bpmHint}. The instrumentation features a prominent synth bass line, a consistent kick drum, and a clap on the off-beats, creating a danceable groove. Synthesizer pads provide harmonic support, and a plucked synth melody adds a catchy element. The vocalist sings in Romanian, delivering a powerful and clear performance with occasional ad-libs. The song structure is typical of pop music, with verses, pre-choruses, and choruses. The melody is memorable and uplifting. The key is minor. Production elements include reverb on the vocals and a clear, punchy mix. ${languageHint}`,
            "Hip Hop": `A Romanian pop-trap ballad with a ${vocalDesc} vocalist delivering emotional vocals over modern hip-hop beats. The tempo is ${bpmHint}. Features 808 basslines, trap hi-hats, atmospheric pads, and melodic piano elements. Vocal delivery is heartfelt with subtle autotune and layered harmonies. Contemporary R&B-influenced production with emotional depth and urban edge. ${languageHint}`,
            "Retro-Disco": `A Romanian disco-pop ballad with a ${vocalDesc} vocalist delivering soulful vocals over 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass, lush string arrangements, vintage synth pads, and smooth guitar. Classic disco-soul production with warm analog sounds, soaring harmonies, and romantic energy. Timeless dance floor emotion. ${languageHint}`,
            "Pop Rock": `A Romanian pop-rock ballad with a ${vocalDesc} vocalist delivering powerful emotional vocals over rock instrumentation. The tempo is ${bpmHint}. Features clean electric guitars, piano, driving bass, and dynamic drums. Anthemic choruses with emotional intensity and memorable melodic hooks. Production combines rock dynamics with pop sensibility and heartfelt delivery. ${languageHint}`,
            "Tech-House": `A Romanian deep house production with a ${vocalDesc} vocalist delivering emotional vocal hooks over minimal grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, deep rolling bassline, atmospheric pads, and subtle percussion. Hypnotic groove with processed vocals, filter sweeps, and introspective club energy. Modern deep house with emotional Romanian pop essence. ${languageHint}`,
          },
          Corina: {
            Original: `A Romanian pop song with a reggae influence, featuring a ${vocalDesc} vocalist and a male rapper. The tempo is ${bpmHint}. The song is in a major key. The instrumentation includes a drum machine providing a reggae-style beat, a synth bass playing a simple, repetitive line, and a synth playing a melodic counterpoint. The female vocals are clear and melodic, while the male vocals are delivered in a rhythmic rap style. The song structure alternates between verses and a chorus, with an instrumental break. Production elements include a clean mix with clear separation between instruments and vocals, and a slight reverb on the vocals. ${languageHint}`,
            "Hip Hop": `A Romanian reggae-trap fusion with a ${vocalDesc} vocalist blending smooth vocals with modern hip-hop beats. The tempo is ${bpmHint}. Features 808 basslines, trap hi-hats, reggae-influenced guitar elements, and atmospheric pads. Vocal delivery combines laid-back singing with rhythmic rap flows. Contemporary production mixing Caribbean vibes with urban edge. Tropical street sound. ${languageHint}`,
            "Retro-Disco": `A Romanian reggae-disco fusion with a ${vocalDesc} vocalist delivering smooth vocals over 70s/80s grooves with Caribbean flavor. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass with reggae touches, rhythmic guitar, lush strings, and tropical percussion. Classic disco production with reggae offbeats, warm analog sounds, and sunny dance energy. Beach party meets Studio 54. ${languageHint}`,
            "Pop Rock": `A Romanian reggae-rock track with a ${vocalDesc} vocalist delivering smooth vocals over rock instrumentation with Caribbean influence. The tempo is ${bpmHint}. Features clean guitars with reggae skanks, driving bass, steady drums with offbeat accents, and melodic hooks. Production blends rock energy with reggae groove and pop accessibility. Summer anthem vibes. ${languageHint}`,
            "Tech-House": `A Romanian tropical house production with a ${vocalDesc} vocalist delivering smooth vocal hooks over minimal grooves with Caribbean flavor. The tempo is ${bpmHint}. Features four-on-the-floor kick, deep rolling bassline, tropical percussion (steel drums, maracas), and warm synth pads. Hypnotic groove with reggae-influenced elements and beach club energy. Modern tropical house with Romanian pop touch. ${languageHint}`,
          },
          Delia: {
            Original: `An upbeat dance-pop track with a driving electronic beat and a prominent synth melody. The song features a ${vocalDesc} vocalist with a clear, energetic delivery. The tempo is ${bpmHint}. The instrumentation includes a synth bass providing a strong rhythmic foundation, a bright synth lead carrying the main melody, and a four-on-the-floor kick drum pattern with a clap on the off-beats. The chord progression is simple and repetitive, contributing to the danceable feel. Production is clean and modern, with a focus on clarity and punchiness. The song structure is verse-chorus, with a pre-chorus build-up. The key is major, creating a cheerful and optimistic mood. There are also spoken word sections and vocal ad-libs that add to the playful nature of the track. ${languageHint}`,
            "Hip Hop": `A Romanian pop-trap production with a ${vocalDesc} vocalist blending catchy pop vocals with modern hip-hop beats. The tempo is ${bpmHint}. Features rolling 808s, crisp trap hi-hats, snappy snares, and melodic synth elements. Vocal delivery combines playful singing with rhythmic rap-influenced flows. Contemporary urban production with autotune touches and punchy energy. Pop meets street style. ${languageHint}`,
            "Retro-Disco": `A Romanian disco-pop track with a ${vocalDesc} vocalist delivering upbeat vocals over 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar strums, lush string sections, and vintage synth leads. Classic disco production with handclaps, soaring harmonies, and infectious dance energy. Retro charm with Romanian pop flavor. ${languageHint}`,
            "Pop Rock": `A Romanian pop-rock track with a ${vocalDesc} vocalist delivering energetic vocals over rock instrumentation. The tempo is ${bpmHint}. Features electric guitars, driving bass, energetic drums with crashes, and catchy melodic hooks. Anthemic choruses with pop-rock energy and radio appeal. Production balances rock attitude with pop accessibility and playful spirit. ${languageHint}`,
            "Tech-House": `A Romanian tech house production with a ${vocalDesc} vocalist delivering catchy vocal hooks over minimal techno grooves. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, rolling bassline, crisp percussion loops, and bright synth stabs. Hypnotic groove with vocal chops, filter sweeps, and club-ready energy. Modern dance production with Romanian pop sensibility. ${languageHint}`,
          },
          "DJ Project": {
            Original: `A pop ballad in a minor key, featuring a ${vocalDesc} vocalist. The tempo is ${bpmHint}. The instrumentation includes a piano playing arpeggiated chords, a string section providing sustained harmonies, and a drum kit with a soft, rhythmic beat. The bass guitar plays a supportive, melodic line. The vocalist sings with a clear, emotional tone, utilizing vibrato and occasional melisma. The song structure follows a typical verse-chorus format with a bridge and an outro. The production emphasizes a clean, spacious mix, with the vocals prominent. Reverb is applied to the vocals and strings, creating a sense of depth. The overall mood is melancholic yet hopeful. ${languageHint}`,
            "Hip Hop": `A Romanian pop-trap ballad with a ${vocalDesc} vocalist delivering emotional vocals over modern hip-hop beats. The tempo is ${bpmHint}. Features 808 basslines, trap hi-hats, atmospheric pads, and melodic piano. Vocal delivery is heartfelt with contemporary R&B influences and subtle autotune. Modern production with emotional depth and urban sophistication. ${languageHint}`,
            "Retro-Disco": `A Romanian disco-pop ballad with a ${vocalDesc} vocalist delivering soulful, emotional vocals over 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass, lush string arrangements, vintage synth pads, and smooth guitar. Classic disco-soul production with warm analog sounds, soaring harmonies, and romantic dance floor energy. ${languageHint}`,
            "Pop Rock": `A Romanian pop-rock ballad with a ${vocalDesc} vocalist delivering powerful emotional vocals over rock instrumentation. The tempo is ${bpmHint}. Features electric guitars, piano elements, driving bass, and dynamic drums. Anthemic choruses with emotional intensity and memorable hooks. Production combines rock dynamics with pop sensibility and heartfelt Romanian sentiment. ${languageHint}`,
            "Tech-House": `A Romanian deep house production with a ${vocalDesc} vocalist delivering emotional vocal hooks over minimal grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, deep rolling bassline, atmospheric pads, and subtle percussion. Hypnotic groove with processed vocals, filter sweeps, and introspective club energy. Modern deep house with Romanian pop emotional essence. ${languageHint}`,
          },
          florianrus: {
            Original: `A Romanian pop-rap track with a melancholic yet danceable vibe. It features a ${vocalDesc} vocalist with a clear, slightly melancholic tone, delivering both sung melodies and rap verses. The tempo is ${bpmHint}. The instrumentation includes a prominent acoustic guitar playing a repeating arpeggiated figure, a synth bass providing a deep, rhythmic foundation, and a drum machine with a standard pop beat. A synth pad adds atmospheric texture, and a subtle, high-pitched synth melody occasionally punctuates the arrangement. The chord progression is consistent throughout the song, creating a sense of familiarity. The song structure follows a typical pop format with verses, a pre-chorus, and a chorus. The production is clean, with the vocals mixed prominently and the instruments well-balanced. There are occasional vocal ad-libs and harmonies that add depth to the chorus. The key is minor, contributing to the melancholic mood. ${languageHint}`,
            "Hip Hop": `A Romanian trap production with a ${vocalDesc} vocalist delivering melodic rap flows over hard-hitting hip-hop beats. The tempo is ${bpmHint}. Features heavy 808 basslines, rapid hi-hats, snappy snares, and dark atmospheric pads. Vocal delivery is raw and authentic with melodic hooks and rap verses. Modern urban production with aggressive drums, vocal layers, and street credibility. Pure Romanian trap energy. ${languageHint}`,
            "Retro-Disco": `A Romanian urban-disco fusion with a ${vocalDesc} vocalist blending smooth rap-singing with 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar, vintage synth strings, and disco percussion. Unique blend of urban storytelling over classic disco instrumental. Playful production mixing retro warmth with contemporary Romanian urban style. ${languageHint}`,
            "Pop Rock": `A Romanian urban-rock track with a ${vocalDesc} vocalist delivering melodic rap-singing over rock instrumentation. The tempo is ${bpmHint}. Features electric guitars, driving bass, energetic drums, and melodic elements. Vocal delivery blends singing and rapping with rock energy. Production combines urban authenticity with rock attitude and pop accessibility. Modern Romanian crossover sound. ${languageHint}`,
            "Tech-House": `A Romanian urban tech house track with a ${vocalDesc} vocalist delivering melodic rap-singing over minimal techno grooves. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, deep rolling bassline, crisp percussion, and atmospheric pads. Hypnotic groove with urban vocal elements processed as rhythmic layers. Underground club production with Romanian street poetry. ${languageHint}`,
          },
          Oficial: {
            Original: `An upbeat Romanian dance-pop track with a driving electronic drum beat and a prominent synth bassline. The tempo is ${bpmHint}. The key is C minor. The song features a ${vocalDesc} vocalist with a clear, slightly processed voice, delivering both sung melodies and spoken word sections. The instrumentation includes a synth pad providing harmonic support, a bright synth lead playing melodic phrases, and a percussive synth element that adds rhythmic texture. The drum machine features a standard four-on-the-floor kick pattern, a snare on beats two and four, and a consistent hi-hat pattern. The bassline is a simple, repetitive arpeggiated pattern that provides a strong rhythmic and harmonic foundation. The song structure follows a typical verse-chorus format with an instrumental intro and outro. Production elements include reverb on the vocals and some delay on the synth lead. The mix is clean and balanced, with the vocals prominent in the foreground. ${languageHint}`,
            "Hip Hop": `A Romanian pop-trap track with a ${vocalDesc} vocalist blending upbeat pop vocals with modern hip-hop beats. The tempo is ${bpmHint}. Features rolling 808s, crisp hi-hats, trap snares, and melodic synth elements. Vocal delivery combines confident singing with rhythmic flows. Contemporary urban production with feel-good energy and punchy drums. Pop meets hip-hop positivity. ${languageHint}`,
            "Retro-Disco": `A Romanian disco-pop track with a ${vocalDesc} vocalist delivering upbeat, confident vocals over 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar, lush strings, and vintage synth leads. Classic disco production with handclaps, soaring harmonies, and feel-good dance energy. Retro summer vibes with Romanian flavor. ${languageHint}`,
            "Pop Rock": `A Romanian pop-rock track with a ${vocalDesc} vocalist delivering confident, energetic vocals over rock instrumentation. The tempo is ${bpmHint}. Features electric guitars, driving bass, energetic drums, and catchy hooks. Anthemic choruses with feel-good energy and radio appeal. Production balances rock attitude with pop accessibility and summer anthem vibes. ${languageHint}`,
            "Tech-House": `A Romanian tech house production with a ${vocalDesc} vocalist delivering upbeat vocal hooks over minimal grooves. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, rolling bassline, crisp percussion, and bright synth stabs. Hypnotic groove with vocal chops, filter sweeps, and feel-good club energy. Modern summer dance production with Romanian pop sunshine. ${languageHint}`,
          },
          Shift: {
            Original: `An upbeat Romanian dance track featuring a ${vocalDesc} vocalist rapping over a driving electronic beat. The tempo is ${bpmHint}. The instrumentation includes a prominent synth bassline, a four-on-the-floor kick drum, a snare drum with a strong reverb, and various synth pads and arpeggios providing melodic and harmonic content. The vocal delivery is energetic and rhythmic, with some spoken word elements. The song structure is verse-chorus, with a clear build-up to the chorus. The production is clean and modern, with a strong emphasis on danceability. The key appears to be minor, contributing to a slightly melancholic yet energetic feel. There are no complex chord progressions, primarily relying on a repeating two or four-chord loop. The melody is primarily carried by the synth elements and the vocal line. ${languageHint}`,
            "Hip Hop": `A Romanian trap production with a ${vocalDesc} vocalist delivering dynamic rap flows with melodic hooks over hard-hitting beats. The tempo is ${bpmHint}. Features heavy 808 basslines, rapid hi-hats, snappy snares, and atmospheric pads. Vocal delivery is versatile with aggressive rap verses and catchy sung choruses. Modern urban production with punchy drums and bold energy. Pure Romanian trap fusion. ${languageHint}`,
            "Retro-Disco": `A Romanian dance-rap disco fusion with a ${vocalDesc} vocalist blending singing and rapping over 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar, vintage synth strings, and disco percussion. Unique blend of rap flows and melodic hooks over classic disco instrumental. Playful retro-urban fusion with Romanian flair. ${languageHint}`,
            "Pop Rock": `A Romanian dance-rock track with a ${vocalDesc} vocalist blending singing and rapping over rock instrumentation. The tempo is ${bpmHint}. Features electric guitars, driving bass, energetic drums, and melodic elements. Vocal delivery alternates between rock choruses and rap verses. Production combines rock energy with urban attitude and dance accessibility. Modern crossover sound. ${languageHint}`,
            "Tech-House": `A Romanian tech house track with a ${vocalDesc} vocalist blending melodic singing and rhythmic rapping over minimal grooves. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, deep rolling bassline, crisp percussion, and synth stabs. Hypnotic groove with vocal versatility and club energy. Modern dance production with urban Romanian flavor. ${languageHint}`,
          },
          Simplu: {
            Original: `A Romanian pop-rock track with a driving tempo, featuring a ${vocalDesc} vocalist. The tempo is ${bpmHint}. The song is in a major key, with a simple, repetitive chord progression that emphasizes the upbeat and energetic feel. The instrumentation includes a prominent synth bass providing a strong rhythmic foundation, a clean electric guitar playing melodic lines and rhythmic chords, and a standard drum kit with a clear, punchy snare and kick. The vocals are delivered with a clear, slightly processed tone, often layered with harmonies in the chorus sections. Production is clean and modern, with a focus on clarity and impact. The song structure follows a typical verse-chorus format, with a bridge providing a slight dynamic shift before returning to the main chorus. The melody is catchy and memorable, designed for sing-along appeal. There are no complex time signature changes or intricate instrumental solos, maintaining a straightforward and accessible pop-rock aesthetic. ${languageHint}`,
            "Hip Hop": `A Romanian pop-rap ballad with a ${vocalDesc} vocalist delivering emotional vocals with rap influences over modern beats. The tempo is ${bpmHint}. Features 808 basslines, trap hi-hats, acoustic guitar elements, and atmospheric pads. Vocal delivery blends heartfelt singing with melodic rap flows. Contemporary production with organic and urban elements, emotional depth and authenticity. ${languageHint}`,
            "Retro-Disco": `A Romanian pop-disco ballad with a ${vocalDesc} vocalist delivering soulful, emotional vocals over 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass, lush string arrangements, vintage synth pads, and smooth guitar. Classic disco-soul production with warm analog sounds, soaring harmonies, and romantic dance energy. Timeless emotional groove. ${languageHint}`,
            "Pop Rock": `A Romanian rock ballad with a ${vocalDesc} vocalist delivering powerful emotional vocals over full band instrumentation. The tempo is ${bpmHint}. Features electric guitars, acoustic guitar, piano, driving bass, and dynamic drums. Anthemic choruses with emotional intensity and memorable hooks. Classic pop-rock production with heartfelt Romanian sentiment and timeless appeal. ${languageHint}`,
            "Tech-House": `A Romanian deep house production with a ${vocalDesc} vocalist delivering emotional vocal hooks over minimal grooves with organic touches. The tempo is ${bpmHint}. Features four-on-the-floor kick, deep rolling bassline, atmospheric pads, acoustic guitar samples, and subtle percussion. Hypnotic groove with processed vocals and introspective club energy. Modern deep house with Romanian emotional essence. ${languageHint}`,
          },
          Smiley: {
            Original: `A Romanian hip-hop track with a melancholic and aggressive tone. The song features a ${vocalDesc} vocalist rapping over a beat that combines electronic drums, a prominent bassline, and a sampled string melody. The tempo is ${bpmHint}. The key appears to be minor, contributing to the somber mood. Production elements include reverb on the vocals and a somewhat compressed mix, giving it a raw, underground feel. The song structure follows a typical verse-chorus format, with an instrumental intro and outro. The vocal delivery is passionate and expressive, shifting between rapping and a more melodic, almost spoken-word style in certain sections. The string sample provides a recurring melodic motif throughout the track. ${languageHint}`,
            "Hip Hop": `A Romanian trap production with a ${vocalDesc} vocalist delivering dynamic rap flows and melodic hooks over hard-hitting beats. The tempo is ${bpmHint}. Features heavy 808 basslines, rapid hi-hats, snappy snares, and dark atmospheric pads. Vocal delivery is authentic with aggressive verses and catchy choruses. Modern urban production with punchy drums, vocal layers, and Romanian street credibility. Pure trap energy. ${languageHint}`,
            "Retro-Disco": `A Romanian hip-hop disco fusion with a ${vocalDesc} vocalist blending smooth rap flows with 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar, vintage synth strings, and disco percussion. Rap verses with melodic sung hooks over classic disco instrumental. Unique blend of Romanian urban style with retro dance warmth. ${languageHint}`,
            "Pop Rock": `A Romanian rap-rock track with a ${vocalDesc} vocalist delivering melodic rap flows over rock instrumentation. The tempo is ${bpmHint}. Features electric guitars, driving bass, energetic drums, and melodic elements. Vocal delivery blends smooth rapping with rock-influenced choruses. Production combines urban authenticity with rock energy and pop accessibility. Modern crossover appeal. ${languageHint}`,
            "Tech-House": `A Romanian tech house track with a ${vocalDesc} vocalist delivering melodic rap flows over minimal grooves. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, deep rolling bassline, crisp percussion, and atmospheric pads. Hypnotic groove with rap vocals processed as rhythmic elements and melodic hooks. Underground club production with Romanian urban sophistication. ${languageHint}`,
          },
          "What's UP": {
            Original: `A Romanian hip-hop track with a melancholic yet driving feel. The song features a ${vocalDesc} vocalist delivering rap verses and a melodic chorus. The tempo is ${bpmHint}. The instrumentation includes a prominent acoustic guitar playing a repeating arpeggiated figure, a subtle string section providing atmospheric pads, and a consistent drum beat with a strong kick and snare. A synth bass provides a deep, rhythmic foundation. The production is clean, with the vocals mixed prominently. The key appears to be minor, contributing to the somber mood. The song structure alternates between verses and a recurring chorus, with an instrumental break featuring the acoustic guitar and strings. The vocal delivery is expressive, shifting between a rhythmic rap and a more melodic, almost sung, chorus. ${languageHint}`,
            "Hip Hop": `A Romanian trap production with a ${vocalDesc} vocalist delivering introspective rap flows over modern hip-hop beats. The tempo is ${bpmHint}. Features 808 basslines, trap hi-hats, snappy snares, and atmospheric pads. Vocal delivery is authentic and thoughtful with melodic rap verses and catchy hooks. Contemporary urban production with emotional storytelling, punchy drums, and Romanian street wisdom. ${languageHint}`,
            "Retro-Disco": `A Romanian hip-hop disco fusion with a ${vocalDesc} vocalist blending introspective rap flows with 70s/80s grooves. The tempo is ${bpmHint}. Features four-on-the-floor kick, funky bass guitar, rhythmic guitar, vintage synth sounds, and disco percussion. Thoughtful rap verses with melodic hooks over classic disco instrumental. Unique blend of Romanian urban introspection with retro dance energy. ${languageHint}`,
            "Pop Rock": `A Romanian rap-rock track with a ${vocalDesc} vocalist delivering introspective rap flows over rock instrumentation. The tempo is ${bpmHint}. Features electric guitars, driving bass, dynamic drums, and melodic elements. Vocal delivery combines thoughtful rapping with rock-influenced melodic sections. Production blends urban authenticity with rock dynamics and emotional depth. Modern alternative crossover. ${languageHint}`,
            "Tech-House": `A Romanian tech house track with a ${vocalDesc} vocalist delivering introspective rap flows over minimal grooves. The tempo is ${bpmHint}. Features driving four-on-the-floor kick, deep rolling bassline, crisp percussion, and atmospheric pads. Hypnotic groove with rap vocals as rhythmic storytelling elements. Underground club production with Romanian urban poetry and emotional depth. ${languageHint}`,
          },
        };

        // Find matching song  key in URL
        for (const [songKey, styles] of Object.entries(styleDescriptions)) {
          if (songUrl.includes(songKey)) {
            // Return the style for the selected genre, or Original as fallback
            return (
              styles[styleKey] ||
              styles["Original"] ||
              `${genre} ${bpmHint} ${languageHint}`
            );
          }
        }

        // Default: Use genre + BPM + language hint
        return languageHint
          ? `${genre} ${bpmHint} ${languageHint}`
          : `${genre} ${bpmHint}`;
      };

      const detailedStyle = getDetailedStyle(
        currentSong,
        musicData.genre,
        musicData.mood
      );
      console.log(
        `🎨 Style description length: ${detailedStyle.length} chars (max 1000 for V5)`
      );

      // Build the request body
      const requestBody: any = {
        prompt: processedLyrics, // Use the processed lyrics (with diacritics if Romanian)
        style: detailedStyle, // Detailed style description for better music generation
        title: songTitle,
        customMode: true,
        instrumental: false, // Always false since we removed instrumental option
        model: "V4_5ALL", // V4_5ALL generates ~1 minute music (faster, 2-3 min instead of 4-5 min)
        callBackUrl: `${baseUrl}/api/callback`,
        weirdnessConstraint: 0.5, // Creative deviation/novelty (50%)
        styleWeight: 0.85, // Style guidance weight (85%)
        audioWeight: 1.0, // Input audio influence weight (100%)
        uploadUrl: audioUploadUrl, // Always include the fixed ING audio URL
      };

      // Handle vocal type
      if (musicData.vocalType === "duet") {
        // For duet: don't set vocalGender, let the model use both voices
        // Add duet instruction to the style
        requestBody.style = `${detailedStyle} duet male and female vocals`;
        console.log(`🎤 Duet mode enabled - style: "${requestBody.style}"`);
      } else {
        // For single voice: set vocalGender
        requestBody.vocalGender = musicData.vocalType === "male" ? "m" : "f";
        console.log(
          `🎤 Single voice: ${musicData.vocalType} (${requestBody.vocalGender})`
        );
      }

      // Call Suno API
      console.log(`\n🚀 === CALLING SUNO API V4.5ALL ===`);
      console.log(`📍 Endpoint: ${endpoint}`);
      console.log(`🎼 ING Base Track: Fac Ce vreau`);
      console.log(`🎵 Genre: ${musicData.genre}`);
      console.log(`🎭 Mood: ${musicData.mood}`);
      console.log(`\n📦 Full Request Body:`);
      console.log(`   - Title: "${requestBody.title}"`);
      console.log(`   - Model: ${requestBody.model}`);
      console.log(`   - Custom Mode: ${requestBody.customMode}`);
      console.log(`   - Instrumental: ${requestBody.instrumental}`);
      console.log(
        `   - Vocal Gender: ${requestBody.vocalGender || "duet (both)"}`
      );
      console.log(`   - Lyrics length: ${requestBody.prompt.length} chars`);
      console.log(
        `   - Style length: ${requestBody.style.length} chars (max 1000)`
      );
      console.log(`   - Callback URL: ${requestBody.callBackUrl}`);
      console.log(`\n⚙️  API Parameters:`);
      console.log(`   - Weirdness: ${requestBody.weirdnessConstraint * 100}%`);
      console.log(`   - Style Weight: ${requestBody.styleWeight * 100}%`);
      console.log(`   - Audio Weight: ${requestBody.audioWeight * 100}%`);
      console.log(`\n🎵 ING Reference Audio (Fixed):`);
      console.log(`   - URL: ${requestBody.uploadUrl}`);
      console.log(`   - Track: Fac Ce vreau (ING Base Track)`);
      console.log(`\n📝 Style Description Preview:`);
      console.log(`   "${requestBody.style.substring(0, 200)}..."`);
      console.log(`\n⏱️  Expected completion: ~2-3 minutes (120-180s) - generates ~1 min music`);

      // Call Suno API directly (queue disabled for ING project)
      console.log(`\n🎯 === CALLING SUNO API DIRECTLY ===`);
      const sunoStart = Date.now();
      
      const sunoResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!sunoResponse.ok) {
        const errorText = await sunoResponse.text();
        console.error(`❌ Suno API Error:`, errorText);
        throw new Error(
          `Music generation failed: ${sunoResponse.status} ${sunoResponse.statusText}`
        );
      }

      const sunoResult = await sunoResponse.json();
      const sunoTime = ((Date.now() - sunoStart) / 1000).toFixed(2);
      console.log(`📡 Suno API call completed in ${sunoTime}s`);

      if (sunoResult.code !== 200) {
        console.error(`❌ Suno API returned error:`, sunoResult);
        throw new Error(sunoResult.msg || "Failed to generate music");
      }

      const taskId = sunoResult.data?.taskId;

      if (!taskId) {
        console.error("❌ No taskId in Suno response:", sunoResult);
        throw new Error("No task ID received from Suno API");
      }

      console.log(`\n✅ Task created: ${taskId}`);

      // Poll for results with progressive UI updates
      // First callback: Stream preview ready (~20-30s) - Show celebration, then preview
      // Second callback: Full quality ready (~2-5 min) - Show celebration, then upgrade to full
      const pollResult = await pollForCompletion(
        taskId,
        apiKey,
        360, // maxAttempts - 6 minutes timeout (handles slower devices: 4-5 min observed)
        (readyTracks: any[]) => {
          const isStreamPreview = readyTracks.some((t) => t.isStreaming);
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

          if (isStreamPreview) {
            // STREAM PREVIEW READY (~20-30s)
            console.log(
              `\n⚡ === STREAM PREVIEW CALLBACK: Showing preview player ===`
            );
            console.log(`⏱️  Time to preview: ${totalTime}s`);
            console.log(
              `🎧 Stream playback available while full quality generates...`
            );

            // Process and save tracks
            processAndDisplayTracks(readyTracks, musicData, processedLyrics);

            // Show preview player inline - users can listen immediately
            setState("preview-playing");
            console.log(`� Showing preview player with playable tracks...`);
          } else {
            // FULL QUALITY READY (~2-5 min) OR upgrade from stream
            console.log(
              `\n⚡ === FULL QUALITY CALLBACK: Upgrading to full quality ===`
            );
            console.log(`⏱️  Time to full quality: ${totalTime}s`);
            console.log(`📥 Full download URLs now available`);

            // Process and save tracks
            processAndDisplayTracks(readyTracks, musicData, processedLyrics);

            // Redirect directly to results page (no celebration screen)
            console.log(`� Redirecting to results page...`);
            router.push("/results");
          }
        }
      );

      // pollResult will only have data if callback wasn't called (SUCCESS without FIRST_SUCCESS)
      // In normal flow, callback handles everything and pollResult is returned after callback
      console.log(`\n✅ === MUSIC GENERATION COMPLETE ===`);
    } catch (err) {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n❌ === MUSIC GENERATION FAILED (${totalTime}s) ===`);
      console.error("Error:", err);
      
      // Clear active job on failure
      clearActiveJob();
      
      // Check if it's a max retries error
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      const isMaxRetriesError = errorMessage.includes("Failed after") || errorMessage.includes("attempts");
      
      // Always use sanitized error message
      setError(getUserFriendlyError(errorMessage));
      
      setState("input");
    }
  };

  const pollForLyrics = async (
    taskId: string,
    apiKey: string,
    mood: string,
    summary: string,
    maxAttempts = 180 // 6 minutes timeout (180 attempts * 2s = 360s)
  ): Promise<LyricsOption[]> => {
    const startTime = Date.now();
    console.log(`\n🎯 === LYRICS GENERATION STARTED ===`);
    console.log(`📝 Task ID: ${taskId}`);
    console.log(`⏰ Start time: ${new Date(startTime).toLocaleTimeString()}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const attemptTime = Date.now();
        console.log(
          `\n🔄 Attempt ${attempt + 1}/${maxAttempts} (${(
            (attemptTime - startTime) /
            1000
          ).toFixed(1)}s elapsed)`
        );

        const response = await fetch(
          `https://api.sunoapi.org/api/v1/lyrics/record-info?taskId=${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          console.error(`❌ Polling failed: HTTP ${response.status}`);
          const errorText = await response.text();
          console.error(`❌ Response body:`, errorText);

          if (attempt < maxAttempts - 3) {
            console.log(`⏰ Retry in 2s...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }

          throw new Error(`Lyrics polling failed: ${response.status}`);
        }

        const result = await response.json();
        const taskStatus = result.data?.status || "UNKNOWN";

        console.log(`📊 Status: ${taskStatus}`);

        if (result.code === 200 && result.data) {
          // Check if generation is complete
          if (
            (taskStatus === "SUCCESS" || taskStatus === "complete") &&
            result.data.response?.data
          ) {
            const lyricsData = result.data.response.data;
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n✅ === LYRICS GENERATION COMPLETE ===`);
            console.log(`⏱️  Total time: ${totalTime}s`);
            console.log(`📝 Generated ${lyricsData.length} lyrics options`);
            return lyricsData;
          }

          // Check for failure states - throw immediately
          if (
            taskStatus === "failed" ||
            taskStatus === "error" ||
            taskStatus === "FAILED" ||
            taskStatus === "GENERATE_LYRIC_FAILED"
          ) {
            const errorMsg =
              result.data.errorMessage ||
              result.data.error ||
              "Lyrics generation failed";
            console.error(`\n❌ === SUNO LYRICS GENERATION FAILED ===`);
            console.error(`📝 Task ID: ${taskId}`);
            console.error(`❌ Error: ${errorMsg}`);
            console.error(`📊 Full response:`, JSON.stringify(result, null, 2));

            // FALLBACK: Use OpenAI to generate lyrics
            console.log(`\n🔄 === FALLING BACK TO OPENAI ===`);
            console.log(`🤖 Generating lyrics with GPT-4o-mini...`);

            try {
              const detectedLanguage = detectLanguage(summary);
              const fallbackStartTime = Date.now();

              const openaiResponse = await fetch("/api/generate-lyrics", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  summary: summary,
                  mood: mood,
                  language: detectedLanguage,
                }),
              });

              if (!openaiResponse.ok) {
                throw new Error("OpenAI fallback also failed");
              }

              const openaiResult = await openaiResponse.json();
              const fallbackTime = (
                (Date.now() - fallbackStartTime) /
                1000
              ).toFixed(1);

              console.log(`✅ OpenAI fallback succeeded in ${fallbackTime}s`);
              console.log(
                `📝 Generated lyrics length: ${openaiResult.length} chars`
              );

              const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(
                `\n✅ === LYRICS GENERATION COMPLETE (OPENAI FALLBACK) ===`
              );
              console.log(`⏱️  Total time: ${totalTime}s`);
              console.log(`📝 Generated 1 lyrics option via OpenAI`);

              // Return in Suno format
              return [
                {
                  text: openaiResult.lyrics,
                  title: `${
                    mood.charAt(0).toUpperCase() + mood.slice(1)
                  } Version (AI)`,
                  status: "complete",
                },
              ];
            } catch (fallbackError) {
              console.error(`❌ OpenAI fallback failed:`, fallbackError);
              throw new Error(`Both Suno and OpenAI failed: ${errorMsg}`);
            }
          }

          // Still processing
          console.log(`⏳ Processing... (${taskStatus})`);
        }

        // Wait 2 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error("❌ Polling error:", err);
        if (err instanceof Error && err.message.includes("failed")) {
          throw err;
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n⏰ === SUNO TIMEOUT AFTER ${totalTime}s ===`);
    console.log(`\n🔄 === FALLING BACK TO OPENAI (TIMEOUT) ===`);
    console.log(`🤖 Generating lyrics with GPT-4o-mini...`);

    // FALLBACK: Use OpenAI when Suno times out
    try {
      const detectedLanguage = detectLanguage(summary);
      const fallbackStartTime = Date.now();

      const openaiResponse = await fetch("/api/generate-lyrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: summary,
          mood: mood,
          language: detectedLanguage,
        }),
      });

      if (!openaiResponse.ok) {
        throw new Error("OpenAI fallback also failed");
      }

      const openaiResult = await openaiResponse.json();
      const fallbackTime = ((Date.now() - fallbackStartTime) / 1000).toFixed(1);

      console.log(`✅ OpenAI fallback succeeded in ${fallbackTime}s`);
      console.log(`📝 Generated lyrics length: ${openaiResult.length} chars`);

      const totalTimeWithFallback = ((Date.now() - startTime) / 1000).toFixed(
        1
      );
      console.log(`\n✅ === LYRICS GENERATION COMPLETE (OPENAI FALLBACK) ===`);
      console.log(`⏱️  Total time: ${totalTimeWithFallback}s`);
      console.log(`📝 Generated 1 lyrics option via OpenAI`);

      // Return in Suno format
      return [
        {
          text: openaiResult.lyrics,
          title: `${mood.charAt(0).toUpperCase() + mood.slice(1)} Version (AI)`,
          status: "complete",
        },
      ];
    } catch (fallbackError) {
      console.error(`❌ OpenAI fallback failed:`, fallbackError);
      throw new Error(
        "Lyrics generation timed out and OpenAI fallback also failed. Please try again."
      );
    }
  };

  // Background function to upgrade stream URLs to full download URLs
  // NOTE: Background upgrade removed - Suno API expires task ID after FIRST_SUCCESS
  // Tracks are immediately available with audioUrl after ~127s
  // const upgradeToFullQuality = async (...) => { ... }

  const pollForCompletion = async (
    taskId: string,
    apiKey: string,
    maxAttempts = 360, // 6 minutes timeout - handles slower devices (4-5 min observed)
    onStreamReady?: (tracks: any[]) => void // Callback when audio URLs are ready
  ): Promise<any> => {
    const startTime = Date.now();
    console.log(`\n🎵 === MUSIC GENERATION STARTED ===`);
    console.log(`📝 Task ID: ${taskId}`);
    console.log(`⏰ Start time: ${new Date(startTime).toLocaleTimeString()}`);
    console.log(`⚡ Polling every 1 second - waiting for audio URLs`);
    console.log(
      `🎯 Expected: SUCCESS with audioUrl in 2-5 minutes (device-dependent)`
    );

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const attemptTime = Date.now();
        const elapsed = ((attemptTime - startTime) / 1000).toFixed(1);
        console.log(
          `\n🔄 Attempt ${attempt + 1}/${maxAttempts} (${elapsed}s elapsed)`
        );

        const response = await fetch(
          `https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          console.error(`❌ Polling failed: HTTP ${response.status}`);
          const errorText = await response.text();
          console.error(`❌ Response body:`, errorText);

          // Don't throw immediately, wait and retry
          if (attempt < maxAttempts - 3) {
            console.log(`⏰ Retry in 1s...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }

          throw new Error(`Polling failed: ${response.status}`);
        }

        const result = await response.json();
        const taskStatus = result.data?.status || "UNKNOWN";

        console.log(`� Status: ${taskStatus}`);

        // Log progress percentage if available
        if (result.data?.progress) {
          console.log(`📈 Progress: ${result.data.progress}%`);
        }

        if (result.code === 200 && result.data) {
          // Check for failure states
          if (
            taskStatus === "CREATE_TASK_FAILED" ||
            taskStatus === "GENERATE_AUDIO_FAILED" ||
            taskStatus === "CALLBACK_EXCEPTION" ||
            taskStatus === "SENSITIVE_WORD_ERROR"
          ) {
            const errorMsg = result.data.errorMessage || "Generation failed";
            console.error(`❌ Task failed: ${errorMsg}`);
            throw new Error(`Music generation failed: ${errorMsg}`);
          }

          // Check for stream URLs becoming available (happens much earlier than full audio)
          // According to sunoapi.org playground: streamAudioUrl available after ~20-30s
          if (result.data.response?.sunoData) {
            const sunoData = result.data.response.sunoData;
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

            // Check which tracks have stream URLs vs full audio URLs
            const tracksWithStreamUrls = sunoData.filter(
              (item: any) =>
                item.streamAudioUrl || item.streamUrl || item.stream_url
            );

            const tracksWithFullUrls = sunoData.filter(
              (item: any) => item.audioUrl || item.audio_url
            );

            // Log track details with URL inspection
            console.log(`\n📊 === TRACK URL ANALYSIS (${totalTime}s) ===`);
            sunoData.forEach((track: any, i: number) => {
              console.log(`\n  Track ${i + 1}: "${track.title}"`);
              console.log(
                `    - streamAudioUrl: ${
                  track.streamAudioUrl ? "EXISTS ✅" : "MISSING ❌"
                }`
              );
              console.log(
                `    - streamUrl: ${
                  track.streamUrl ? "EXISTS ✅" : "MISSING ❌"
                }`
              );
              console.log(
                `    - audioUrl: ${track.audioUrl ? "EXISTS ✅" : "MISSING ❌"}`
              );
              console.log(
                `    - stream_url: ${
                  track.stream_url ? "EXISTS ✅" : "MISSING ❌"
                }`
              );
              console.log(
                `    - audio_url: ${
                  track.audio_url ? "EXISTS ✅" : "MISSING ❌"
                }`
              );
            });

            // STREAM PREVIEW AVAILABLE (~20-30s) - Show preview while full track generates
            if (
              tracksWithStreamUrls.length === sunoData.length &&
              tracksWithFullUrls.length === 0
            ) {
              console.log(`\n⚡ === STREAM PREVIEW READY (${totalTime}s) ===`);
              console.log(
                `🎵 All ${sunoData.length} track(s) have stream URLs`
              );
              console.log(`⏳ Full audio URLs still generating...`);

              // Map tracks with stream URLs for preview playback
              const streamPreviewTracks = sunoData.map((item: any) => ({
                id: item.id,
                title: item.title || "ING Music Track",
                genre: item.tags || "Unknown",
                audioUrl:
                  item.streamAudioUrl || item.streamUrl || item.stream_url, // Use stream URL for playback
                streamUrl:
                  item.streamAudioUrl || item.streamUrl || item.stream_url, // Store stream URL separately
                imageUrl: item.imageUrl || item.image_url,
                isStreaming: true, // Mark as streaming preview
                isUpgrading: true, // Show "upgrading" indicator
                duration:
                  item.duration && !isNaN(item.duration)
                    ? `${Math.floor(item.duration / 60)}:${Math.floor(
                        item.duration % 60
                      )
                        .toString()
                        .padStart(2, "0")}`
                    : undefined,
              }));

              // Call callback to show preview UI immediately
              if (onStreamReady) {
                console.log(
                  `\n⚡ === CALLING UI UPDATE CALLBACK (STREAM PREVIEW) ===`
                );
                console.log(
                  `🚀 UI will show stream preview with ${streamPreviewTracks.length} track(s)`
                );
                console.log(
                  `⏳ Will continue polling for full quality audio...`
                );
                onStreamReady(streamPreviewTracks);
              }

              // Continue polling for full audio URLs
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }

            // FULL QUALITY AVAILABLE (~2-5 min) - Upgrade to full download URLs
            if (tracksWithFullUrls.length === sunoData.length) {
              console.log(`\n✅ === FULL QUALITY READY (${totalTime}s) ===`);
              console.log(
                `📥 All ${sunoData.length} track(s) have full audio URLs`
              );
              console.log(`📊 Status: ${taskStatus}`);

              // Map tracks with full audio URLs
              const fullQualityTracks = sunoData.map((item: any) => ({
                id: item.id,
                title: item.title || "ING Music Track",
                genre: item.tags || "Unknown",
                audioUrl: item.audioUrl || item.audio_url, // Use full quality URL
                streamUrl:
                  item.streamAudioUrl || item.streamUrl || item.stream_url, // Keep stream URL for reference
                imageUrl: item.imageUrl || item.image_url,
                isStreaming: false, // No longer streaming
                isUpgrading: false, // Upgrade complete
                duration:
                  item.duration && !isNaN(item.duration)
                    ? `${Math.floor(item.duration / 60)}:${Math.floor(
                        item.duration % 60
                      )
                        .toString()
                        .padStart(2, "0")}`
                    : undefined,
              }));

              // Call callback to upgrade UI to full quality
              if (onStreamReady) {
                console.log(
                  `\n⚡ === CALLING UI UPDATE CALLBACK (FULL QUALITY) ===`
                );
                console.log(
                  `🚀 UI will upgrade to full quality for ${fullQualityTracks.length} track(s)`
                );
                onStreamReady(fullQualityTracks);
              }

              // Return the full quality tracks
              console.log(
                `✅ Generation complete - returning ${fullQualityTracks.length} track(s)`
              );
              return fullQualityTracks;
            }

            // PARTIAL STATE - Some URLs available but not all
            if (
              tracksWithStreamUrls.length > 0 ||
              tracksWithFullUrls.length > 0
            ) {
              console.log(
                `⏳ Partial URLs: ${tracksWithStreamUrls.length} stream, ${tracksWithFullUrls.length} full`
              );
              console.log(`   Waiting for all ${sunoData.length} tracks...`);
            }
          }

          // Still processing (PENDING, TEXT_SUCCESS, FIRST_SUCCESS, etc.)
          console.log(`⏳ Processing... (${taskStatus})`);
        }

        // Wait 1 second before next poll
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.error("❌ Polling error:", err);
        // Don't break on individual polling errors, continue trying
        if (err instanceof Error && err.message.includes("generation failed")) {
          throw err; // Re-throw if it's a failure status
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n⏰ === TIMEOUT AFTER ${totalTime}s ===`);
    throw new Error(
      "Music generation is taking longer than expected. Please try again."
    );
  };

  const handleGenerateAnother = () => {
    setState("input");
    setTracks([]);
    setError(null);
    setCurrentPrompt("");
    setCurrentSong("");
    setLyricsOptions([]);
    setHasSelectedLyrics(false);
  };

  const handleBackToPrompt = () => {
    setState("input");
    setLyricsOptions([]);
    setHasSelectedLyrics(false);
    // Keep currentPrompt, currentSong, and currentMoods cached
  };

  const handleClearPrompt = () => {
    setCurrentPrompt("");
    // Keep the song selection - don't clear it
    // setCurrentSong("");
    setCurrentMoods([]);
  };

  const handleRegenerateLyrics = async () => {
    // Regenerate lyrics with the same prompt, song, and moods
    // This keeps the user on the lyrics selection page with new options
    if (currentPrompt && currentSong && currentMoods.length === 2) {
      // Clear current selections and show loading
      setLyricsOptions([]);
      setHasSelectedLyrics(false);
      // Generate new lyrics (handleGenerateLyrics will set state back to lyrics-selection)
      await handleGenerateLyrics(currentPrompt, currentSong, currentMoods);
    }
  };

  const handleDeleteTrack = (trackId: string) => {
    try {
      // Remove track from state
      const updatedTracks = tracks.filter((track) => track.id !== trackId);
      setTracks(updatedTracks);

      // Update localStorage
      const existingTracks = localStorage.getItem("ing_generated_tracks");
      if (existingTracks) {
        const allTracks = JSON.parse(existingTracks);
        const filteredTracks = allTracks.filter((t: Track) => t.id !== trackId);
        localStorage.setItem(
          "ing_generated_tracks",
          JSON.stringify(filteredTracks)
        );
        console.log(`🗑️ Deleted track ${trackId} from localStorage`);
      }
    } catch (err) {
      console.error("Failed to delete track:", err);
      setError("Failed to delete track. Please try again.");
    }
  };

  const handleGenerateVariation = async (
    originalTrack: Track,
    newGenre: string
  ) => {
    if (
      !originalTrack.lyrics ||
      !originalTrack.vocalType ||
      !originalTrack.mood
    ) {
      setError("Cannot generate variation: missing track metadata");
      return;
    }

    setState("loading");
    setError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_SUNO_API_KEY;
      if (!apiKey) {
        throw new Error("API key is not configured");
      }

      // Use the original track's data but with the new genre
      const musicData = {
        genre: newGenre,
        vocalType: originalTrack.vocalType as "male" | "female" | "duet",
        mood: originalTrack.mood as "sad" | "chill" | "creative" | "hype",
        title: `${
          originalTrack.title.split(" REMIX")[0]
        } ${newGenre.toUpperCase()} REMIX`,
        remixedBy: undefined,
      };

      // Generate the variation using the same music generation logic
      await handleMusicGeneration(originalTrack.lyrics, musicData);
    } catch (err) {
      console.error("Error generating variation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate variation"
      );
      setState("results");
    }
  };

  const handleLyricsSelected = (hasSelection: boolean) => {
    setHasSelectedLyrics(hasSelection);
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center py-8 px-4">
      {/* Floating bubbles background */}
      <div className="absolute inset-0 overflow-hidden -z-10" aria-hidden>
        {/* Generate a few bubbles with varying sizes/delays */}
        <div
          className="bubble"
          style={{
            width: 160,
            height: 160,
            left: "5%",
            bottom: "-20%",
            animationDuration: "28s",
            animationDelay: "0s",
            background: "rgba(255,255,255,0.06)",
          }}
        />
        <div
          className="bubble"
          style={{
            width: 120,
            height: 120,
            left: "20%",
            bottom: "-10%",
            animationDuration: "22s",
            animationDelay: "4s",
            background: "rgba(255,255,255,0.05)",
          }}
        />
        <div
          className="bubble"
          style={{
            width: 200,
            height: 200,
            left: "40%",
            bottom: "-30%",
            animationDuration: "32s",
            animationDelay: "2s",
            background: "rgba(255,255,255,0.04)",
          }}
        />
        <div
          className="bubble"
          style={{
            width: 100,
            height: 100,
            left: "65%",
            bottom: "-15%",
            animationDuration: "20s",
            animationDelay: "6s",
            background: "rgba(255,255,255,0.07)",
          }}
        />
        <div
          className="bubble"
          style={{
            width: 140,
            height: 140,
            left: "85%",
            bottom: "-25%",
            animationDuration: "26s",
            animationDelay: "3s",
            background: "rgba(255,255,255,0.05)",
          }}
        />
      </div>
      {/* Content Container */}
      <div className="relative z-10 w-full max-w-7xl">
        {/* Landing Section - Show only on input state */}
        {state === "input" && (
          <div className="text-center mb-8 md:mb-12 fade-in">
            {/* Logo/Brand Area with ING Logo */}
            <div className="mb-8 md:mb-12 flex flex-col items-center gap-3 md:gap-4">
              {/* ING Logo with enhanced styling */}
              <div className="w-24 h-24 md:w-36 md:h-36 relative animate-float">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-ing-orange via-ing-darkOrange to-ing-orange flex items-center justify-center text-white font-black text-4xl md:text-6xl shadow-2xl ring-4 ring-ing-orange/20 ring-offset-4">
                  ING
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-ing-orange/30 blur-xl -z-10"></div>
              </div>

              {/* Small Label with better styling */}
              <div className="inline-block">
                <p className="text-xs md:text-sm text-gray-400 font-light tracking-widest uppercase bg-gray-50 px-4 py-1.5 rounded-full">
                  BAI The Music Agency
                </p>
              </div>
            </div>

            {/* Content Card with subtle background */}
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 rounded-3xl bg-gradient-to-b from-white/80 to-white/40 backdrop-blur-sm border border-white/50 shadow-xl">
              {/* Main Headline - Enhanced */}
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-ing-dark mb-4 md:mb-6 leading-[1.1] tracking-tight">
                Fac ce <span className="text-ing-orange inline-block hover:scale-110 transition-transform duration-300">vreau</span>.
              </h2>

              {/* Subheadline - Enhanced */}
              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-ing-dark font-bold max-w-3xl mx-auto mb-6 md:mb-8 leading-tight">
                Sunt liber să <span className="text-ing-orange font-black relative inline-block">
                  visez
                  <span className="absolute -bottom-1 left-0 right-0 h-1 bg-ing-orange/30 rounded-full"></span>
                </span>.
              </p>

              {/* Divider */}
              <div className="w-24 h-1 bg-gradient-to-r from-transparent via-ing-orange to-transparent mx-auto mb-6 md:mb-8 rounded-full"></div>

              {/* Description - Enhanced with better structure */}
              <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
                <p className="text-base sm:text-lg md:text-xl text-ing-text leading-relaxed font-normal">
                  Transformă-ți aspirațiile în realitate și creează propria ta variantă a hitului nostru.
                </p>
                
                {/* Highlighted statement box */}
                <div className="bg-gradient-to-br from-ing-orange/5 to-ing-orange/10 border-l-4 border-ing-orange rounded-lg p-4 md:p-6">
                  <p className="text-lg sm:text-xl md:text-2xl font-semibold text-ing-dark leading-snug">
                    Pentru că la <span className="text-ing-orange font-black">ING</span>, susținem oamenii care{" "}
                    <span className="text-ing-orange font-black">îndrăznesc</span> să{" "}
                    <span className="text-ing-orange font-black">facă ce vor</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* View My Tracks Button - Enhanced */}
            <div className="mt-8 md:mt-12 px-4">
              <button
                onClick={() => router.push("/results")}
                className="group relative inline-flex items-center justify-center gap-3 bg-white hover:bg-ing-orange text-ing-dark hover:text-white font-bold py-4 px-8 md:px-10 rounded-full transition-all duration-300 border-2 border-ing-orange shadow-lg hover:shadow-2xl hover:shadow-ing-orange/30 transform hover:scale-105 w-full md:w-auto overflow-hidden"
              >
                {/* Animated background */}
                <span className="absolute inset-0 bg-gradient-to-r from-ing-orange to-ing-darkOrange opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                
                {/* Content */}
                <span className="relative flex items-center gap-3 text-base md:text-lg">
                  <span className="text-2xl group-hover:animate-bounce">🎧</span>
                  <span className="font-black tracking-wide">Piesele Mele</span>
                  <svg 
                    className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step Indicator - Show on all states except results and preview playing */}
        {state !== "results" && state !== "preview-playing" && (
          <StepIndicator currentStep={getCurrentStep()} steps={steps} />
        )}

        {/* State-based Content */}
        {state === "input" && (
          <div className="fade-in">
            <InputForm
              onGenerateLyrics={handleGenerateLyrics}
              isLoading={isGeneratingLyrics}
              cachedPrompt={currentPrompt}
              cachedSong={currentSong}
              cachedMoods={currentMoods}
              onClear={handleClearPrompt}
            />
          </div>
        )}

        {state === "lyrics-selection" && (
          <div className="fade-in">
            <LyricsSelectionWithForm
              options={lyricsOptions}
              onSubmit={handleMusicGeneration}
              onBack={handleBackToPrompt}
              onLyricsSelected={handleLyricsSelected}
              onRegenerateLyrics={handleRegenerateLyrics}
              isLoading={isGeneratingLyrics}
            />
          </div>
        )}

        {state === "loading" && <Loader queueStatus={queueStatus} />}

        {state === "preview-playing" && (
          <PreviewPlayer
            tracks={tracks}
            message="Previzualizarea ta este gata! Bucură-te în timp ce generăm calitate înaltă..."
          />
        )}

        {state === "results" && (
          <TrackGrid
            tracks={tracks}
            onGenerateAnother={handleGenerateAnother}
            onDeleteTrack={handleDeleteTrack}
            onGenerateVariation={handleGenerateVariation}
          />
        )}
      </div>

      {/* Error Message - inside container, at bottom */}
      {error && (
        <div className="relative z-10 w-full max-w-md mx-auto px-4 mt-8 mb-4">
          <div className="p-4 bg-red-500/95 text-white rounded-xl shadow-2xl backdrop-blur-sm border border-red-400/30 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-lg">⚠️</div>
              <div className="flex-1">
                <p className="font-medium text-sm leading-relaxed">
                  {getUserFriendlyError(error)}
                </p>
              </div>
              <button
                onClick={() => setError(null)}
                className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white font-medium py-1.5 px-3 rounded-lg transition-all text-xs hover:scale-105"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 mt-auto pt-12 text-center">
        <p className="text-ing-text text-sm">
          Powered by{" "}
          <a
            href="https://www.ing.nl/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:text-ing-orange transition-colors"
          >
            ING
          </a>
        </p>
      </footer>
    </main>
  );
}
