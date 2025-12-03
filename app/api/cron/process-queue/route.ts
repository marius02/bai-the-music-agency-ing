import { NextRequest, NextResponse } from 'next/server';
import { processNextJob, completeJob, failJob, getQueueStats, getRateLimitConfig } from '../../../lib/queue';
import { containsProfanity, removeProfanity } from '../../../lib/profanity-filter';
import OpenAI from 'openai';

/**
 * Cron job that processes queued jobs with rate limiting
 * Runs every 10 seconds via Vercel Cron
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('\n🔄 === CRON JOB STARTED ===');
  const startTime = Date.now();

  // Get rate limit config from environment
  const rateLimitConfig = getRateLimitConfig();
  const maxJobs = rateLimitConfig.maxRequests; // Process up to rate limit per cron run
  console.log(`⚙️  Rate limit: ${rateLimitConfig.maxRequests} req/${rateLimitConfig.windowSeconds}s`);

  let processedCount = 0;

  try {
    // Get queue stats
    const stats = await getQueueStats();
    console.log(`📊 Queue stats: ${stats.pending} pending jobs, ${stats.rateLimit.remaining} API calls remaining`);

    while (processedCount < maxJobs) {
      const job = await processNextJob();

      if (!job) {
        // No more jobs or rate limited
        console.log('⏸️  No more jobs to process or rate limit reached');
        break;
      }

      try {
        console.log(`\n🔨 Processing ${job.type} job ${job.id} (attempt ${job.attempts})`);

        let result: any;

        if (job.type === 'lyrics') {
          result = await processLyricsJob(job.payload);
        } else if (job.type === 'music') {
          result = await processMusicJob(job.payload);
        } else {
          throw new Error(`Unknown job type: ${job.type}`);
        }

        await completeJob(job.id, result);
        processedCount++;
        console.log(`✅ Job ${job.id} completed successfully`);
      } catch (error: any) {
        console.error(`❌ Job ${job.id} failed:`, error.message);
        await failJob(job.id, error.message);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ === CRON JOB FINISHED ===`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📦 Processed: ${processedCount} jobs`);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      duration: parseFloat(duration),
    });
  } catch (error: any) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}

/**
 * Process lyrics generation job
 */
async function processLyricsJob(payload: any): Promise<any> {
  const { story, moods } = payload;

  // Step 1: Profanity check
  console.log('🛡️ Checking for profanity...');
  const hasProfanity = await containsProfanity(story);
  if (hasProfanity) {
    throw new Error('Te rugăm să eviți limbajul vulgar în descrierea ta.');
  }

  // Step 2: Summarize with GPT
  console.log('🤖 Summarizing story with GPT...');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const moodContext = moods && moods.length > 0
    ? `The story should have a ${moods.join(' and ')} mood.`
    : '';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a creative storytelling assistant that helps create concise, engaging summaries for song lyrics. Your task is to condense stories while ALWAYS preserving:
1. ALL proper names (people's names like Maria, John, Ana, etc.)
2. ALL city/location names (București, New York, Paris, etc.)
3. ALL brand names and specific places (EXCEPT competitor brands)
4. Important emotional details

The summary must be EXACTLY 174 characters or less (not words, CHARACTERS). ${moodContext}

CRITICAL CONTENT FILTERING:
- STRICTLY FORBIDDEN: Remove ALL vulgar, profane, or offensive words in ANY language
- Remove or replace competitor brand mentions: "cola", "coca cola", "coke", "fanta", "sprite", etc.
- Keep the story clean, positive, and family-friendly

CRITICAL: Never replace or generalize names - use them exactly as given!`,
      },
      {
        role: 'user',
        content: `Summarize this Pepsi memory into exactly 174 characters or less. Keep ALL names (people, cities, places) EXACTLY as written. REMOVE and REPLACE any vulgar/profane words with clean alternatives:\n\n${story}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 150,
  });

  const summary = completion.choices[0]?.message?.content?.trim();

  if (!summary) {
    throw new Error('Failed to generate summary');
  }

  // Step 3: Verify GPT output
  console.log('🛡️ Verifying GPT output...');
  let cleanSummary = summary;

  const summaryHasProfanity = await containsProfanity(summary);
  if (summaryHasProfanity) {
    cleanSummary = await removeProfanity(summary);
    if (cleanSummary.trim().length < 10) {
      throw new Error('Te rugăm să reformulezi descrierea fără limbaj vulgar.');
    }
  }

  const finalSummary = cleanSummary.length > 174 ? cleanSummary.substring(0, 174) : cleanSummary;

  // Step 4: Generate lyrics with GPT for all requested moods
  console.log(`🎵 Generating lyrics with GPT for ${moods.length || 1} mood(s)...`);
  const language = detectLanguage(story);
  const moodsToProcess = moods && moods.length > 0 ? moods : ['upbeat'];

  const lyricsVariations = await Promise.all(
    moodsToProcess.map(async (mood: string) => {
      console.log(`   Generating ${mood} lyrics...`);
      
      const lyricsCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional song lyricist. Create structured lyrics in ${language === 'ro' ? 'Romanian' : 'English'} with sections: [Verse], [Prechorus], [Chorus], [Verse 2], [Bridge]. Make it catchy and memorable with a ${mood} mood.`,
          },
          {
            role: 'user',
            content: `Create ${mood} song lyrics based on: ${finalSummary}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 800,
      });

      const lyrics = lyricsCompletion.choices[0]?.message?.content?.trim();

      if (!lyrics) {
        throw new Error(`Failed to generate lyrics for ${mood} mood`);
      }

      console.log(`   ✅ ${mood} lyrics generated`);

      return {
        id: `lyrics-${mood}-${Date.now()}`,
        text: lyrics,
        title: `${mood.charAt(0).toUpperCase() + mood.slice(1)} Version`,
        mood,
      };
    })
  );

  console.log(`✅ All lyrics generated successfully (${lyricsVariations.length} variations)`);

  return {
    summary: finalSummary,
    lyrics: lyricsVariations,
    language,
  };
}

/**
 * Process music generation job
 */
async function processMusicJob(payload: any): Promise<any> {
  const { endpoint, requestBody } = payload;

  console.log('🎵 Calling Suno API V5...');
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log(`🎼 Title: ${requestBody.title}`);

  const apiKey = process.env.NEXT_PUBLIC_SUNO_API_KEY;

  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_SUNO_API_KEY is not configured');
  }

  // Make the actual Suno API call
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Suno API Error (HTTP ${response.status}):`, errorText);
    throw new Error(`Suno API request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.code !== 200) {
    console.error(`❌ API returned error code ${result.code}:`, result.msg);
    throw new Error(result.msg || 'Failed to generate music');
  }

  const taskId = result.data?.taskId;

  if (!taskId) {
    console.error('❌ No taskId in response:', result);
    throw new Error('No task ID received from Suno API');
  }

  console.log('✅ Music generation started, task ID:', taskId);

  return {
    taskId,
    message: 'Music generation started',
  };
}

/**
 * Detect language from text
 */
function detectLanguage(text: string): 'ro' | 'en' {
  const romanianChars = /[ăâîșțĂÂÎȘȚ]/;
  const romanianWords = /\b(și|cu|la|de|pe|în|un|o|este|sunt|este|când|cum|pentru|mai|este)\b/i;

  if (romanianChars.test(text) || romanianWords.test(text)) {
    return 'ro';
  }

  return 'en';
}
