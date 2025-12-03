import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { summary, mood, language } = await request.json();

    if (!summary || !summary.trim()) {
      return NextResponse.json(
        { error: "Summary is required" },
        { status: 400 }
      );
    }

    if (!mood) {
      return NextResponse.json({ error: "Mood is required" }, { status: 400 });
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

    // Mood-specific instructions
    const moodInstructions: Record<string, string> = {
      upbeat:
        "Create upbeat, energetic lyrics with a fun, party vibe. Use dynamic, celebratory language.",
      romantic:
        "Create romantic, sweet lyrics with tender emotions and affection. Use warm, loving language.",
      chill:
        "Create chill, relaxed lyrics with a laid-back, peaceful vibe. Use calm, smooth language.",
      emotional:
        "Create emotional, deep lyrics with heartfelt feelings and meaning. Use expressive, touching language.",
      nostalgic:
        "Create nostalgic, reflective lyrics that evoke memories and past moments. Use wistful, reminiscent language.",
      rebellious:
        "Create rebellious, bold lyrics with edgy confidence and attitude. Use strong, defiant language.",
    };

    const moodInstruction = moodInstructions[mood] || moodInstructions.upbeat;
    const languageInstruction =
      language === "ro"
        ? "Write the lyrics in Romanian with proper diacritics (ă, â, î, ș, ț)."
        : "Write the lyrics in English.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional song lyricist specializing in creating structured, memorable lyrics for pop and dance music. ${languageInstruction}

Your task is to create complete song lyrics based on a short story summary and specific mood.

STRUCTURE REQUIREMENTS:
- Use standard song structure with clear sections: [Verse], [Prechorus], [Chorus], [Verse 2], [Bridge], etc.
- Include 2 verses, 1-2 prechoruses, a catchy chorus (repeated 2-3 times), and optionally a bridge
- Each verse should be 4-6 lines
- Chorus should be 3-5 lines and very catchy/memorable
- Prechorus should be 2-3 lines building to the chorus
- Total length: 400-700 characters

CONTENT REQUIREMENTS:
- ${moodInstruction}
- Base the story/theme on the provided summary
- Use simple, conversational language that's easy to sing
- Include emotional moments and vivid imagery
- Make the chorus very repetitive and memorable
- Preserve ALL proper names from the summary (people, places, brands)

FORMAT:
[Verse]
Line 1
Line 2
...

[Prechorus]
Line 1
Line 2

[Chorus]
Line 1
Line 2
...

[Verse 2]
...

CRITICAL: Keep it clean, positive, and suitable for all audiences. Focus on the emotions and memories.`,
        },
        {
          role: "user",
          content: `Create song lyrics with a ${mood} mood based on this story:\n\n${summary}\n\nMood: ${mood}\nLanguage: ${
            language === "ro" ? "Romanian" : "English"
          }`,
        },
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const lyrics = completion.choices[0]?.message?.content?.trim();

    if (!lyrics) {
      return NextResponse.json(
        { error: "Failed to generate lyrics" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lyrics: lyrics,
      mood: mood,
      language: language,
      length: lyrics.length,
    });
  } catch (error: any) {
    console.error("Error generating lyrics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate lyrics" },
      { status: 500 }
    );
  }
}
