// backend/queue.js
// Serialized queue for gas-sponsored transactions, preventing RPC congestion and burst floods.
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

const QUEUE_NAME = 'sponsor-queue';
const REDIS_URL = process.env.REDIS_URL;

let redisConnection = null;
let sponsorQueue = null;
let queueEvents = null;

// Lightweight in-memory sequential queue for development / standalone servers
class InMemoryQueue {
  constructor() {
    this.chain = Promise.resolve();
    this.workerHandler = null;
    this.jobs = new Map();
  }

  setWorker(handler) {
    this.workerHandler = handler;
  }

  add(name, data, opts = {}) {
    const jobId = opts.jobId || `${name}:${Date.now()}`;

    // Deduplication check
    if (opts.jobId && this.jobs.has(jobId)) {
      console.log(`[InMemoryQueue] Duplicate job dropped: ${jobId}`);
      return Promise.resolve({ id: jobId, deduplicated: true });
    }

    this.jobs.set(jobId, { name, data });

    return new Promise((resolve, reject) => {
      this.chain = this.chain.then(async () => {
        if (!this.workerHandler) {
          this.jobs.delete(jobId);
          return reject(new Error(`[InMemoryQueue] No worker registered for job ${name}`));
        }
        try {
          const result = await this.workerHandler({ name, data, id: jobId });
          this.jobs.delete(jobId);
          resolve({ id: jobId, result });
        } catch (err) {
          this.jobs.delete(jobId);
          reject(err);
        }
      }).catch((chainErr) => {
        this.jobs.delete(jobId);
        reject(chainErr);
      });
    });
  }
}

if (REDIS_URL) {
  try {
    redisConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    sponsorQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
    queueEvents = new QueueEvents(QUEUE_NAME, { connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null }) });
    console.log('[Queue] BullMQ connected to Redis at', REDIS_URL);
  } catch (err) {
    console.warn('[Queue] Failed to connect to Redis, falling back to in-memory queue:', err.message);
    sponsorQueue = new InMemoryQueue();
  }
} else {
  console.log('[Queue] Using serialized in-memory queue (development / single-instance mode)');
  sponsorQueue = new InMemoryQueue();
}

/**
 * Enqueue a sponsored transaction for validation, fee-bumping, and broadcast.
 * Serializes submission to protect the Soroban RPC from rate limits.
 */
export async function enqueueSponsorTx({ innerTxXdr, userAddress }) {
  if (sponsorQueue instanceof InMemoryQueue) {
    const jobRes = await sponsorQueue.add(
      'sponsor_tx',
      { innerTxXdr, userAddress },
      { attempts: 1 }
    );
    return jobRes.result;
  }

  // BullMQ distributed path
  const job = await sponsorQueue.add(
    'sponsor_tx',
    { innerTxXdr, userAddress },
    {
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );

  return await job.waitUntilFinished(queueEvents);
}

export { sponsorQueue, redisConnection, QUEUE_NAME };
