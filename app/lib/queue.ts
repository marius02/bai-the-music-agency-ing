/**
 * Queue Management System with Rate Limiting
 * Uses Vercel KV (Redis) for persistent job queue
 */

import { kv } from '@vercel/kv';
import { Ratelimit } from '@upstash/ratelimit';

// Rate limiter: configurable via environment variables
// Default: 20 requests per 10 seconds for Suno API
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20', 10);
const windowSeconds = parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '10', 10);

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
  analytics: true,
  prefix: 'suno-ratelimit',
});

console.log(`[Queue] Rate limit configured: ${maxRequests} requests per ${windowSeconds} seconds`);

/**
 * Get current rate limit configuration
 */
export function getRateLimitConfig() {
  return {
    maxRequests,
    windowSeconds,
  };
}

export interface QueueJob {
  id: string;
  userId: string;
  type: 'lyrics' | 'music';
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  attempts: number;
  error?: string;
}

/**
 * Add job to queue
 */
export async function enqueueJob(
  job: Omit<QueueJob, 'id' | 'status' | 'createdAt' | 'attempts'>
): Promise<string> {
  const jobId = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

  const queueJob: QueueJob = {
    ...job,
    id: jobId,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
  };

  // Add to pending queue (FIFO)
  await kv.lpush('queue:pending', JSON.stringify(queueJob));

  // Store job details with 1 hour TTL
  await kv.setex(`job:${jobId}`, 3600, JSON.stringify(queueJob));

  console.log(`✅ Job ${jobId} enqueued (type: ${job.type})`);
  return jobId;
}

/**
 * Process next job from queue with rate limiting
 */
export async function processNextJob(): Promise<QueueJob | null> {
  // Check rate limit
  const { success, remaining, reset } = await ratelimit.limit('suno-api');

  if (!success) {
    const waitTime = Math.ceil((reset - Date.now()) / 1000);
    console.log(
      `⏸️ Rate limit reached. Remaining: ${remaining}. Retry in ${waitTime}s`
    );
    return null;
  }

  // Pop job from queue (FIFO - right pop)
  const jobData = await kv.rpop('queue:pending');

  if (!jobData) {
    return null;
  }

  const job: QueueJob = typeof jobData === 'string' ? JSON.parse(jobData) : (jobData as QueueJob);

  // Update job status
  job.status = 'processing';
  job.attempts += 1;
  await kv.setex(`job:${job.id}`, 3600, JSON.stringify(job));

  console.log(`🔄 Processing job ${job.id} (attempt ${job.attempts})`);
  return job;
}

/**
 * Mark job as completed
 */
export async function completeJob(jobId: string, result: any): Promise<void> {
  const jobData = await kv.get(`job:${jobId}`);

  if (!jobData) {
    console.warn(`⚠️ Job ${jobId} not found`);
    return;
  }

  const job: QueueJob = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
  job.status = 'completed';

  // Store updated job and result with 1 hour TTL
  await kv.setex(`job:${jobId}`, 3600, JSON.stringify(job));
  await kv.setex(`result:${jobId}`, 3600, JSON.stringify(result));

  console.log(`✅ Job ${jobId} completed`);
}

/**
 * Mark job as failed and retry if attempts < maxRetries
 */
export async function failJob(
  jobId: string,
  error: string,
  maxRetries = 3
): Promise<void> {
  const jobData = await kv.get(`job:${jobId}`);

  if (!jobData) {
    console.warn(`⚠️ Job ${jobId} not found`);
    return;
  }

  const job: QueueJob = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
  job.error = error;

  if (job.attempts < maxRetries) {
    // Retry: add back to queue
    job.status = 'pending';
    await kv.lpush('queue:pending', JSON.stringify(job));
    await kv.setex(`job:${jobId}`, 3600, JSON.stringify(job));
    console.log(
      `🔄 Job ${jobId} will retry (attempt ${job.attempts + 1}/${maxRetries})`
    );
  } else {
    // Max retries reached
    job.status = 'failed';
    await kv.setex(`job:${jobId}`, 3600, JSON.stringify(job));
    await kv.setex(`error:${jobId}`, 3600, error);
    console.error(`❌ Job ${jobId} failed after ${maxRetries} attempts: ${error}`);
  }
}

/**
 * Get job status with queue position
 */
export async function getJobStatus(jobId: string): Promise<(QueueJob & { queuePosition?: number }) | null> {
  const jobData = await kv.get(`job:${jobId}`);

  if (!jobData) {
    return null;
  }

  const job: QueueJob = typeof jobData === 'string' ? JSON.parse(jobData) : (jobData as QueueJob);

  // If job is pending, calculate its position in the queue
  if (job.status === 'pending') {
    const queuePosition = await getJobQueuePosition(jobId);
    return { ...job, queuePosition };
  }

  return job;
}

/**
 * Get job's position in the queue (1-based index)
 */
async function getJobQueuePosition(jobId: string): Promise<number | undefined> {
  try {
    // Get all jobs in the queue
    const queueLength = await kv.llen('queue:pending');
    
    if (!queueLength || queueLength === 0) {
      return undefined;
    }

    // Get all items in the queue (Redis list is FIFO: 0 = front/next, -1 = back/last)
    const queueItems = await kv.lrange('queue:pending', 0, -1);
    
    if (!queueItems || queueItems.length === 0) {
      return undefined;
    }

    // Find the position of this job (0-based index)
    const position = queueItems.findIndex((item) => {
      const job: QueueJob = typeof item === 'string' ? JSON.parse(item) : (item as QueueJob);
      return job.id === jobId;
    });

    // Return 1-based position (position 0 = "next in queue" = position 1)
    return position >= 0 ? position + 1 : undefined;
  } catch (error) {
    console.error('Error getting queue position:', error);
    return undefined;
  }
}

/**
 * Get job result
 */
export async function getJobResult(jobId: string): Promise<any | null> {
  const resultData = await kv.get(`result:${jobId}`);

  if (!resultData) {
    return null;
  }

  return typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
}

/**
 * Get queue size
 */
export async function getQueueSize(): Promise<number> {
  const size = await kv.llen('queue:pending');
  return size || 0;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  rateLimit: {
    remaining: number;
    reset: number;
  };
}> {
  const pending = await getQueueSize();
  const { remaining, reset } = await ratelimit.limit('suno-api-stats');

  return {
    pending,
    rateLimit: {
      remaining,
      reset,
    },
  };
}
