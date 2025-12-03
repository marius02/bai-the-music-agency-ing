/**
 * Job polling helpers for queue system
 */

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: 'lyrics' | 'music';
  result?: any;
  error?: string;
  message?: string;
  queuePosition?: number;
  estimatedWaitSeconds?: number;
  attempts?: number;
  maxRetries?: number;
}

/**
 * Poll job status until completed or failed
 */
export async function pollJobUntilComplete(
  jobId: string,
  maxAttempts = 60, // 60 attempts × 2s = 2 minutes max
  intervalMs = 2000
): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`/api/job/${jobId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Job not found');
      }
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    const data: JobStatus = await response.json();

    // Log queue position and status
    if (data.status === 'pending' && data.queuePosition) {
      console.log(
        `⏳ Queue position: ${data.queuePosition} | Estimated wait: ${data.estimatedWaitSeconds}s`
      );
    } else if (data.status === 'processing') {
      console.log('🎵 Creating your music...');
    } else {
      console.log(
        `📊 Job ${jobId} status: ${data.status} (attempt ${attempt + 1}/${maxAttempts})`
      );
    }

    if (data.status === 'completed') {
      console.log('✅ Job completed successfully');
      return data.result;
    }

    if (data.status === 'failed') {
      const errorMessage = data.error || 'Job failed';
      console.error(`❌ Job failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Still pending or processing - wait before next check
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Job timeout - exceeded maximum wait time');
}

/**
 * Poll job status with progress callback
 */
export async function pollJobWithProgress(
  jobId: string,
  onProgress: (status: JobStatus) => void,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`/api/job/${jobId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Job not found');
      }
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    const data: JobStatus = await response.json();

    // Call progress callback
    onProgress(data);

    if (data.status === 'completed') {
      return data.result;
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Job failed');
    }

    // Still pending or processing
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Job timeout');
}
