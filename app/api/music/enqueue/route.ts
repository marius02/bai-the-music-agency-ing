import { NextRequest, NextResponse } from 'next/server';
import { enqueueJob } from '../../../lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      endpoint,
      requestBody,
      userId,
    } = body;

    if (!endpoint || !endpoint.trim()) {
      return NextResponse.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      );
    }

    if (!requestBody) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    // Enqueue music generation job
    const jobId = await enqueueJob({
      userId: userId || 'anonymous',
      type: 'music',
      payload: {
        endpoint,
        requestBody,
      },
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Music generation job enqueued. Check status with /api/job/{jobId}',
    });
  } catch (error: any) {
    console.error('Error enqueuing music job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enqueue music job' },
      { status: 500 }
    );
  }
}
