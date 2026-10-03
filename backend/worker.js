// backend/worker.js
// Serialized worker for gas-sponsored transactions (concurrency: 1)
// Prevents Soroban Testnet RPC 429 rate limit congestion.
import { Worker } from 'bullmq';
import { rpc } from '@stellar/stellar-sdk';
import { sponsorQueue, redisConnection, QUEUE_NAME } from './queue.js';
import { validateInnerTx, buildFeeBump } from './sponsor.js';

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';

/**
 * Process a single sponsored transaction job.
 */
export async function processSponsorJob(job) {
  const { innerTxXdr, userAddress } = job.data;
  console.log(`[Worker] Processing sponsored transaction for ${userAddress}`);

  const rpcServer = new rpc.Server(RPC_URL);

  // 1. Validate & simulate inner transaction
  const innerTx = await validateInnerTx(innerTxXdr, userAddress);

  // 2. Build and sign fee-bump transaction
  const feeBump = buildFeeBump(innerTx);

  // 3. Send transaction to Soroban RPC
  const sendRes = await rpcServer.sendTransaction(feeBump);
  if (sendRes.status === 'ERROR') {
    throw new Error('Fee-bump transaction rejected by Stellar network.');
  }

  // 4. Poll for confirmation
  let getTxRes = await rpcServer.getTransaction(sendRes.hash);
  let attempts = 0;
  while (getTxRes.status === 'NOT_FOUND' && attempts < 15) {
    await new Promise((r) => setTimeout(r, 2000));
    getTxRes = await rpcServer.getTransaction(sendRes.hash);
    attempts++;
  }

  if (getTxRes.status !== 'SUCCESS') {
    throw new Error(`Sponsored transaction failed with status: ${getTxRes.status}`);
  }

  console.log(`[Worker] Sponsored transaction confirmed: ${sendRes.hash}`);
  return { success: true, txHash: sendRes.hash };
}

/**
 * Start the sponsor queue worker.
 */
export function startWorker() {
  if (redisConnection && sponsorQueue?.name === QUEUE_NAME) {
    const worker = new Worker(
      QUEUE_NAME,
      async (job) => processSponsorJob(job),
      {
        connection: redisConnection,
        concurrency: 1, // Concurrency 1 shields Soroban RPC from rate limits
      }
    );

    worker.on('completed', (job) => {
      console.log(`[BullMQ] Sponsor job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[BullMQ] Sponsor job ${job?.id} failed:`, err.message);
    });

    return worker;
  } else if (sponsorQueue?.setWorker) {
    sponsorQueue.setWorker(async (job) => processSponsorJob(job));
    console.log('[Worker] In-memory sponsor worker registered with concurrency: 1');
    return sponsorQueue;
  }
}
