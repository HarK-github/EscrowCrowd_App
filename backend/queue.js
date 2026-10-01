// backend/queue.js
// BullMQ queue initialization with graceful in-memory fallback for local development.
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const QUEUE_NAME = 'stream-queue';
const REDIS_URL = process.env.REDIS_URL;

let redisConnection = null;
let streamQueue = null;

// Simple in-memory fallback queue for local development without Redis
class InMemoryQueue {
  constructor() {
    this.chain = Promise.resolve();
    this.workerHandler = null;
    this.jobs = new Map();
  }

  setWorker(handler) {
    this.workerHandler = handler;
  }

  async add(name, data, opts = {}) {
    const jobId = opts.jobId || `${name}:${Date.now()}`;
    // Deduplication check
    if (opts.jobId && this.jobs.has(jobId)) {
      console.log(`[InMemoryQueue] Duplicate job dropped: ${jobId}`);
      return { id: jobId, deduplicated: true };
    }

    this.jobs.set(jobId, { name, data, attempts: 0 });

    // Execute job sequentially (concurrency: 1)
    this.chain = this.chain.then(async () => {
      if (!this.workerHandler) {
        console.warn(`[InMemoryQueue] No worker registered for job ${name}`);
        return;
      }

      const maxAttempts = opts.attempts || 3;
      let delay = opts.backoff?.delay || 1000;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await this.workerHandler({ name, data, id: jobId });
          this.jobs.delete(jobId);
          break;
        } catch (err) {
          console.error(`[InMemoryQueue] Job ${jobId} failed (attempt ${attempt}/${maxAttempts}):`, err.message);
          if (attempt === maxAttempts) {
            this.jobs.delete(jobId);
            throw err;
          }
          await new Promise((res) => setTimeout(res, delay));
          delay *= 2; // exponential backoff
        }
      }
    }).catch((err) => {
      console.error(`[InMemoryQueue] Unhandled job failure:`, err.message);
    });

    return { id: jobId, queued: true };
  }
}

if (REDIS_URL) {
  try {
    redisConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    streamQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
    console.log('[Queue] BullMQ connected to Redis at', REDIS_URL);
  } catch (err) {
    console.warn('[Queue] Failed to connect to Redis, falling back to in-memory queue:', err.message);
    streamQueue = new InMemoryQueue();
  }
} else {
  console.log('[Queue] No REDIS_URL provided; using serialized in-memory queue (development mode)');
  streamQueue = new InMemoryQueue();
}

/**
 * Enqueue a stream settlement payout.
 * Enforces deduplication within the current 10-second epoch.
 */
export async function enqueueSettlement({ streamId, claimAmount, contractId }) {
  const epoch = Math.floor(Date.now() / 10000); // 10s deduplication window
  const jobId = `settle:${streamId}:${epoch}`;

  return await streamQueue.add(
    'settle_stream',
    {
      streamId: String(streamId),
      claimAmount: String(claimAmount),
      contractId: contractId || process.env.FLEX_ESCROW_CONTRACT_ID,
    },
    {
      jobId,
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s -> 4s -> 8s -> 16s
      },
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

export { streamQueue, redisConnection };
