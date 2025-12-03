"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TrackGrid from "../components/TrackGrid";

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

export default function ResultsPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Load tracks from localStorage
    const loadTracks = () => {
      try {
        const savedTracks = localStorage.getItem("ing_generated_tracks");
        if (savedTracks) {
          const parsedTracks = JSON.parse(savedTracks);
          setTracks(parsedTracks);
        }
      } catch (error) {
        console.error("Error loading tracks from localStorage:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTracks();
  }, []);

  const handleGenerateAnother = () => {
    router.push("/");
  };

  const handleDeleteTrack = (trackId: string) => {
    try {
      // Remove track from state
      const updatedTracks = tracks.filter(track => track.id !== trackId);
      setTracks(updatedTracks);

      // Update localStorage
      const existingTracks = localStorage.getItem("ing_generated_tracks");
      if (existingTracks) {
        const allTracks = JSON.parse(existingTracks);
        const filteredTracks = allTracks.filter((t: Track) => t.id !== trackId);
        localStorage.setItem("ing_generated_tracks", JSON.stringify(filteredTracks));
        console.log(`🗑️ Deleted track ${trackId} from localStorage`);
      }
    } catch (err) {
      console.error("Failed to delete track:", err);
      alert("Eroare la ștergerea piesei. Te rugăm să încerci din nou.");
    }
  };

  const handleClearAll = () => {
    if (confirm("Ești sigur că vrei să ștergi toate piesele generate?")) {
      localStorage.removeItem("ing_generated_tracks");
      setTracks([]);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center py-8 px-4">
        {/* Floating bubbles background */}
        <div className="absolute inset-0 overflow-hidden -z-10" aria-hidden>
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

        <div className="text-center text-white">
          <div className="spinner w-16 h-16 mx-auto mb-4"></div>
          <p className="text-xl">Se încarcă piesele tale...</p>
        </div>
      </main>
    );
  }

  if (tracks.length === 0) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center py-8 px-4">
        {/* Floating bubbles background */}
        <div className="absolute inset-0 overflow-hidden -z-10" aria-hidden>
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

        <div className="relative z-10 text-center max-w-2xl bg-white/95 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl border border-ing-orange/20">
          <h1 className="text-5xl md:text-6xl font-black text-ing-dark mb-6">
            Nicio Piesă Încă! 🎵
          </h1>
          <p className="text-xl text-ing-text mb-8">
            Nu ai creat încă nicio experiență muzicală ING. Începe să-ți creezi coloana sonoră acum!
          </p>
          <button
            onClick={handleGenerateAnother}
            className="group relative inline-flex items-center justify-center gap-3 bg-ing-orange hover:bg-ing-darkOrange text-white font-bold py-4 px-8 rounded-full transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-ing-orange/30 transform hover:scale-105 text-lg"
          >
            <span className="text-2xl group-hover:animate-bounce">🎵</span>
            <span>Creează Prima Ta Piesă</span>
          </button>
        </div>

        {/* Footer */}
        <footer className="relative z-10 mt-auto pt-12 text-center">
          <p className="text-ing-text/80 text-sm">
            Powered by{" "}
            <a
              href="https://www.ing.ro/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ing-dark hover:text-ing-orange transition-colors"
            >
              ING Romania
            </a>
          </p>
        </footer>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center py-8 px-4 pb-32 md:pb-8">
      {/* Floating bubbles background */}
      <div className="absolute inset-0 overflow-hidden -z-10" aria-hidden>
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

      <div className="relative z-10 w-full">
        <TrackGrid 
          tracks={tracks} 
          onGenerateAnother={handleGenerateAnother} 
          onDeleteTrack={handleDeleteTrack}
        />

        {/* Clear All Button */}
        <div className="text-center mt-8">
          <button
            onClick={handleClearAll}
            className="bg-white hover:bg-gray-100 text-ing-dark font-semibold py-3 px-8 rounded-xl transition-all duration-300 border-2 border-gray-300 hover:border-ing-orange shadow-md hover:shadow-lg"
          >
            🗑️ Șterge Toate Piesele
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-auto pt-12 text-center">
        <p className="text-ing-text/80 text-sm">
          Powered by{" "}
          <a
            href="https://www.ing.ro/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ing-dark hover:text-ing-orange transition-colors"
          >
            ING Romania
          </a>
        </p>
      </footer>
    </main>
  );
}
