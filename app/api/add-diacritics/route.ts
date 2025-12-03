import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { lyrics, language } = await request.json();

    if (!lyrics || !lyrics.trim()) {
      return NextResponse.json(
        { error: "Lyrics are required" },
        { status: 400 }
      );
    }

    // Only process if language is Romanian
    if (language !== "ro") {
      return NextResponse.json({ lyrics }); // Return original if not Romanian
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a Romanian language expert. Your task is to add proper Romanian diacritics (ă, â, î, ș, ț) to Romanian text.

RULES:
1. Add diacritics ONLY where grammatically correct in Romanian
2. Preserve ALL formatting (line breaks, punctuation, spacing, capitalization)
3. Do NOT change any words, just add the proper diacritics
4. Do NOT translate or modify the text in any way
5. Return ONLY the corrected text, nothing else

Examples:
- "fata" → "fața"
- "si" → "și"
- "tara" → "țara"
- "acasa" → "acasă"
- "sunt" → "sunt" (no change needed)
- "inima" → "inima" or "inimă" (depending on context)`,
        },
        {
          role: "user",
          content: lyrics,
        },
      ],
      temperature: 0.1, // Low temperature for consistency
    });

    const correctedLyrics =
      completion.choices[0]?.message?.content?.trim() || lyrics;

    return NextResponse.json({ lyrics: correctedLyrics });
  } catch (error) {
    console.error("Error adding diacritics:", error);
    return NextResponse.json(
      {
        error: "Failed to add diacritics",
        lyrics: (await request.json()).lyrics,
      },
      { status: 500 }
    );
  }
}
