import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { story, moods } = await request.json();

    if (!story || !story.trim()) {
      return NextResponse.json(
        { error: 'Story is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const moodContext = moods && moods.length > 0 
      ? `The story should have a ${moods.join(' and ')} mood.` 
      : '';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Transform user dreams/goals into strategic action plans (174 chars max). Format as step-by-step milestones to achieve the goal. Preserve names. Remove profanity. Write in Romanian if input is Romanian. Example: if goal is "play in national football team" → "train daily, join youth academy, excel in regional leagues, attract scouts, sign professional contract, earn national team call-up"`,
        },
        {
          role: 'user',
          content: `Convert this dream into actionable steps (174 chars max):\n${story}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 120,
    });

    const summary = completion.choices[0]?.message?.content?.trim();

    if (!summary) {
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: 500 }
      );
    }

    // Ensure summary is within 174 characters
    const finalSummary = summary.length > 174 ? summary.substring(0, 174) : summary;

    return NextResponse.json({
      summary: finalSummary,
      originalLength: story.length,
      summaryLength: finalSummary.length,
    });
  } catch (error: any) {
    console.error('Error summarizing story:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to summarize story' },
      { status: 500 }
    );
  }
}
