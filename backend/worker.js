// backend/worker.js
// Serialized settlement worker (concurrency: 1) preventing Stellar txBAD_SEQ sequence collisions.
import { Worker } from 'bullmq';
import {
  Keypair,
  TransactionBuilder,
  Contract,
  rpc,
  nativeToScVal,
  Networks,
} from '@stellar/stellar-sdk';
import { streamQueue, redisConnection } from './queue.js';
import { recordSettlement, getStreamSnapshot } from './streams.js';

const QUEUE_NAME = 'stream-queue';
const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

export function getOperatorKeypair() {
  const secret = process.env.OPERATOR_SECRET_KEY;
  if (secret && secret.startsWith('S')) {
    return Keypair.fromSecret(secret);
  }
  // Development fallback
  return Keypair.random();
}

/**
 * Process a single settlement job.
 */
export async function processSettlementJob(job, io = null) {
  const { streamId, claimAmount, contractId } = job.data;
  console.log(`[Worker] Processing settlement for stream ${streamId}, amount: ${claimAmount} stroops`);

  const operator = getOperatorKeypair();

  // If no contractId is specified, record settlement locally and broadcast
  if (!contractId) {
    console.log(`[Worker] No contractId specified; recording settlement locally`);
    recordSettlement(streamId, claimAmount);
    if (io) {
      const snap = getStreamSnapshot(streamId);
      io.to(`stream:${streamId}`).emit('stream:settled', {
        streamId,
        claimAmount,
        snapshot: snap,
      });
    }
    return { simulated: true, streamId, claimAmount };
  }

  const rpcServer = new rpc.Server(RPC_URL);

  // 1. Fetch operator account sequence
  let account;
  try {
    account = await rpcServer.getAccount(operator.publicKey());
  } catch (err) {
    throw new Error(`Failed to load operator account ${operator.publicKey()}: ${err.message}`);
  }

  // 2. Build settle_stream transaction
  const contract = new Contract(contractId);
  const callOp = contract.call(
    'settle_stream',
    nativeToScVal(operator.publicKey(), { type: 'address' }),
    nativeToScVal(BigInt(streamId), { type: 'u64' }),
    nativeToScVal(BigInt(claimAmount), { type: 'i128' })
  );

  const tx = new TransactionBuilder(account, {
    fee: '1000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(callOp)
    .setTimeout(30)
    .build();

  // 3. Simulate transaction to obtain footprint and auth
  const simRes = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simRes)) {
    throw new Error(`Simulation failed: ${simRes.error}`);
  }

  // 4. Assemble and sign
  const preparedTx = rpc.assembleTransaction(tx, simRes).build();
  preparedTx.sign(operator);

  // 5. Send transaction
  const sendRes = await rpcServer.sendTransaction(preparedTx);
  if (sendRes.status === 'ERROR') {
    throw new Error(`Transaction send error: ${JSON.stringify(sendRes.errorResult)}`);
  }

  const txHash = sendRes.hash;
  console.log(`[Worker] Transaction submitted: ${txHash}. Awaiting confirmation...`);

  // 6. Poll for completion
  let statusRes = await rpcServer.getTransaction(txHash);
  let pollAttempts = 0;
  while (statusRes.status === 'NOT_FOUND' && pollAttempts < 10) {
    await new Promise((res) => setTimeout(res, 2000));
    statusRes = await rpcServer.getTransaction(txHash);
    pollAttempts++;
  }

  if (statusRes.status !== 'SUCCESS') {
    throw new Error(`Transaction ${txHash} did not succeed: status ${statusRes.status}`);
  }

  // 7. Update local state and broadcast
  recordSettlement(streamId, claimAmount);
  if (io) {
    const snap = getStreamSnapshot(streamId);
    io.to(`stream:${streamId}`).emit('stream:settled', {
      streamId,
      claimAmount,
      txHash,
      snapshot: snap,
    });
  }

  console.log(`[Worker] Settlement confirmed on-chain for stream ${streamId}, tx: ${txHash}`);
  return { success: true, txHash, streamId, claimAmount };
}

/**
 * Start the settlement queue worker.
 */
export function startWorker(io = null) {
  if (redisConnection && streamQueue?.name === QUEUE_NAME) {
    const worker = new Worker(
      QUEUE_NAME,
      async (job) => processSettlementJob(job, io),
      {
        connection: redisConnection,
        concurrency: 1, // Strict serialization prevents sequence collisions
      }
    );

    worker.on('completed', (job) => {
      console.log(`[BullMQ] Settlement job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[BullMQ] Settlement job ${job?.id} failed:`, err.message);
    });

    return worker;
  } else if (streamQueue?.setWorker) {
    streamQueue.setWorker(async (job) => processSettlementJob(job, io));
    console.log('[Worker] In-memory worker registered with concurrency: 1');
    return streamQueue;
  }
}
