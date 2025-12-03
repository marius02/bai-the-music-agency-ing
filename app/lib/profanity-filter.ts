/**
 * Romanian Profanity Filter
 * Uses OpenAI moderation API for intelligent profanity detection
 */

import OpenAI from 'openai';

// Fallback: minimal list of extremely vulgar Romanian words for offline/fallback detection
// This is only used if OpenAI API fails
const CRITICAL_PROFANITY: string[] = [
  "pula", "pulă", "pizda", "pizdă", "fut", "muie", "cacat", "căcat",
];

/**
 * Check if text contains profanity using OpenAI moderation API
 */
export async function containsProfanity(text: string): Promise<boolean> {
  if (!text) return false;
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ OpenAI API key not configured, using fallback profanity filter');
      return containsProfanityFallback(text);
    }

    const openai = new OpenAI({ apiKey });

    // Use OpenAI moderation endpoint
    const moderation = await openai.moderations.create({
      input: text,
    });

    const result = moderation.results[0];
    
    // Check if flagged for any inappropriate content
    if (result.flagged) {
      console.log(`🛡️ OpenAI Moderation flagged content:`, {
        sexual: result.categories.sexual,
        hate: result.categories.hate,
        harassment: result.categories.harassment,
        'self-harm': result.categories['self-harm'],
        violence: result.categories.violence,
      });
      return true;
    }

    // Additionally use GPT to check specifically for Romanian profanity
    // since moderation API is primarily English-focused
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a content moderator that detects profanity and vulgar language in ANY language, especially Romanian. 
          
Respond with ONLY "YES" or "NO".

- YES if the text contains ANY profane, vulgar, offensive, or sexually explicit words in Romanian, English, or any other language
- NO if the text is completely clean and appropriate for all audiences

Be strict but fair. Consider context - medical terms used appropriately are OK, but vulgar slang is not.`,
        },
        {
          role: 'user',
          content: `Does this text contain profanity or vulgar language?\n\nText: "${text}"`,
        },
      ],
      temperature: 0,
      max_tokens: 10,
    });

    const response = completion.choices[0]?.message?.content?.trim().toUpperCase();
    
    if (response === 'YES') {
      console.log('🛡️ GPT-4 detected profanity in text');
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Error checking profanity with OpenAI, using fallback:', error);
    // Fallback to basic detection if API fails
    return containsProfanityFallback(text);
  }
}

/**
 * Fallback profanity detection using minimal hardcoded list
 * Only checks for extremely vulgar words
 */
function containsProfanityFallback(text: string): boolean {
  if (!text) return false;
  
  const normalizedText = text.toLowerCase();
  
  // Check for critical profanity words
  for (const word of CRITICAL_PROFANITY) {
    // Use word boundaries to avoid false positives
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalizedText)) {
      console.log(`🛡️ Fallback filter detected: "${word}"`);
      return true;
    }
  }
  
  return false;
}

/**
 * Synchronous version for client-side quick checks
 * Uses only fallback detection
 */
export function containsProfanitySync(text: string): boolean {
  return containsProfanityFallback(text);
}

/**
 * Remove profanity from text using OpenAI
 */
export async function removeProfanity(text: string): Promise<string> {
  if (!text) return text;
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ OpenAI API key not configured, returning original text');
      return text;
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a content filter that removes or replaces profanity and vulgar language while preserving the meaning of the text.

Remove or replace ALL profane, vulgar, offensive, or sexually explicit words in ANY language (especially Romanian and English).

Rules:
1. Replace vulgar words with appropriate alternatives that convey the same emotion
2. Preserve all proper names, places, and non-vulgar content
3. Keep the same language as the input
4. Maintain the overall meaning and emotion
5. Return ONLY the cleaned text, nothing else`,
        },
        {
          role: 'user',
          content: `Clean this text by removing/replacing any profanity or vulgar language:\n\n${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const cleanedText = completion.choices[0]?.message?.content?.trim();
    
    if (!cleanedText) {
      console.warn('⚠️ Failed to clean text with OpenAI, returning original');
      return text;
    }

    console.log('✅ Text cleaned by GPT-4');
    return cleanedText;
  } catch (error) {
    console.error('❌ Error removing profanity with OpenAI:', error);
    return text;
  }
}

/**
 * Validate and clean user input
 * Returns cleaned text or throws error if profanity detected
 */
export async function validateAndCleanInput(text: string, throwError: boolean = true): Promise<string> {
  const hasProfanity = await containsProfanity(text);
  
  if (hasProfanity) {
    if (throwError) {
      throw new Error('Te rugăm să eviți limbajul vulgar în descrierea ta.');
    }
    // If not throwing error, clean the text
    return await removeProfanity(text);
  }
  
  return text;
}
