import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus, getJobResult, getRateLimitConfig } from '../../../lib/queue';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const status = await getJobStatus(jobId);

    if (!status) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get rate limit config for wait time calculation
    const rateLimitConfig = getRateLimitConfig();

    let response: any = {
      jobId: status.id,
      status: status.status,
      type: status.type,
      createdAt: status.createdAt,
      attempts: status.attempts,
      maxRetries: 3,
    };

    if (status.status === 'completed') {
      const result = await getJobResult(jobId);
      response.result = result;
    }

    if (status.status === 'failed') {
      response.error = status.error || 'Job failed';
      if (status.attempts >= 3) {
        response.message = `Generation failed after ${status.attempts} attempts. Please try a fresh generation with different settings or try again later.`;
      } else {
        response.message = `Failed: ${status.error}`;
      }
    }

    if (status.status === 'pending') {
      // Include queue position for pending jobs
      response.queuePosition = (status as any).queuePosition;
      
      // Show retry info if this is a retry
      if (status.attempts > 0) {
        response.message = `Retrying... (attempt ${status.attempts + 1}/3)`;
      } else {
        // Estimate wait time based on queue position and cron interval
        // Cron runs every 60s in production, processing up to maxRequests jobs per run
        // Formula: ceil(position / maxRequests) * 60s
        if (response.queuePosition) {
          const cronIntervalSeconds = 60; // Vercel cron minimum interval
          const estimatedWaitSeconds = Math.ceil(response.queuePosition / rateLimitConfig.maxRequests) * cronIntervalSeconds;
          response.estimatedWaitSeconds = estimatedWaitSeconds;
          response.message = `Your music is in the queue at position ${response.queuePosition}. Estimated wait: ${estimatedWaitSeconds}s`;
        } else {
          response.message = 'Job is in the queue and will be processed soon...';
        }
      }
    }

    if (status.status === 'processing') {
      if (status.attempts > 1) {
        response.message = `Creating your music... (retry ${status.attempts}/3)`;
      } else {
        response.message = 'Your music is being created right now! 🎵';
      }
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get job status' },
      { status: 500 }
    );
  }
}
