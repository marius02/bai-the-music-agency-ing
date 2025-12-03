import { NextRequest, NextResponse } from "next/server";
import { containsProfanity, removeProfanity } from "../../../lib/profanity-filter";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { code, msg, data } = body;

    if (code === 200 && data?.callbackType === "complete") {
      // Check if lyrics contain profanity using OpenAI moderation
      if (data?.response?.data && Array.isArray(data.response.data)) {
        console.log('🛡️ Checking generated lyrics for profanity with OpenAI...');
        
        for (let index = 0; index < data.response.data.length; index++) {
          const lyricsOption = data.response.data[index];
          
          if (lyricsOption.text) {
            const hasProfanity = await containsProfanity(lyricsOption.text);
            
            if (hasProfanity) {
              console.warn(`⚠️ Profanity detected in lyrics option ${index + 1} - cleaning...`);
              lyricsOption.text = await removeProfanity(lyricsOption.text);
              console.log(`✅ Cleaned lyrics option ${index + 1}`);
            }
          }
        }
      }
      
      return NextResponse.json(
        { status: "received", message: "Lyrics callback processed successfully" },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { status: "error", message: msg },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error processing lyrics callback:', error);
    return NextResponse.json(
      { status: "error", message: "Failed to process callback" },
      { status: 200 }
    );
  }
}
