import { NextRequest, NextResponse } from 'next/server';
import { enqueueJob } from '../../../lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { story, moods, userId } = body;

    if (!story || !story.trim()) {
      return NextResponse.json(
        { error: 'Story is required' },
        { status: 400 }
      );
    }

    // Enqueue lyrics generation job
    const jobId = await enqueueJob({
      userId: userId || 'anonymous',
      type: 'lyrics',
      payload: {
        story,
        moods: moods || [],
      },
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Lyrics generation job enqueued. Check status with /api/job/{jobId}',
    });
  } catch (error: any) {
    console.error('Error enqueuing lyrics job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enqueue lyrics job' },
      { status: 500 }
    );
  }
}
