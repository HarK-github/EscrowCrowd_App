import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import { Keypair, rpc, Horizon, scValToNative } from '@stellar/stellar-sdk';
import 'dotenv/config';
import {
  streams,
  createStream,
  freezeStream,
  resumeStream,
  calculateClaimable,
  getStreamSnapshot,
} from './streams.js';
import { enqueueSettlement } from './queue.js';
import { startWorker } from './worker.js';
import { validateInnerTx, buildFeeBump, getSponsorKeypair, sponsorAvailable, setSponsorAvailable, checkRateLimit } from './sponsor.js';

const app = express();
// Trust the first proxy hop so req.ip is the real client IP, not the proxy IP.
// Required for proxy-aware rate limiting (Vercel, Railway, etc.).
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Timing-safe Bearer token authentication for SLA webhooks
function verifyWebhookAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const expectedSecret = process.env.WEBHOOK_SECRET || 'dev-webhook-secret';
  const expectedHeader = `Bearer ${expectedSecret}`;
  
  const authBuf = Buffer.from(authHeader);
  const expBuf = Buffer.from(expectedHeader);

  if (authBuf.length !== expBuf.length || !crypto.timingSafeEqual(authBuf, expBuf)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
  }
  next();
}

// REST & Webhook endpoints for streaming escrow
app.post('/webhook/freeze', verifyWebhookAuth, (req, res) => {
  try {
    const { streamId, reason } = req.body;
    if (!streamId) return res.status(400).json({ error: 'Missing streamId' });

    const stream = freezeStream(streamId);
    const snap = getStreamSnapshot(streamId);

    io.to(`stream:${streamId}`).emit('stream:frozen', {
      streamId: String(streamId),
      frozenAt: snap.frozenAt,
      reason: reason || 'SLA downtime threshold exceeded',
    });

    console.log(`[Stream ${streamId}] Frozen: ${reason || 'Manual/SLA'}`);
    return res.json({ success: true, stream: snap });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/webhook/resume', verifyWebhookAuth, (req, res) => {
  try {
    const { streamId } = req.body;
    if (!streamId) return res.status(400).json({ error: 'Missing streamId' });

    const stream = resumeStream(streamId);
    const snap = getStreamSnapshot(streamId);

    io.to(`stream:${streamId}`).emit('stream:resumed', {
      streamId: String(streamId),
      frozenSeconds: snap.frozenSeconds,
    });

    console.log(`[Stream ${streamId}] Resumed`);
    return res.json({ success: true, stream: snap });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/streams', (req, res) => {
  try {
    const { streamId, totalDeposit, durationSec, startTime, withdrawn } = req.body;
    if (!streamId || !totalDeposit || !durationSec) {
      return res.status(400).json({ error: 'Missing required stream parameters' });
    }
    createStream({ streamId, totalDeposit, durationSec, startTime, withdrawn });
    const snap = getStreamSnapshot(streamId);
    return res.status(201).json({ success: true, stream: snap });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/streams/:streamId', (req, res) => {
  const snap = getStreamSnapshot(req.params.streamId);
  if (!snap) return res.status(404).json({ error: 'Stream not found' });
  return res.json({ stream: snap });
});

app.post('/api/streams/:streamId/settle', async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = streams.get(String(streamId));
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    let { claimAmount, contractId } = req.body || {};
    if (!claimAmount) {
      const { claimable } = calculateClaimable(stream);
      claimAmount = claimable;
    }

    if (BigInt(claimAmount) <= 0n) {
      return res.status(400).json({ error: 'No claimable funds available to settle' });
    }

    const job = await enqueueSettlement({
      streamId,
      claimAmount: claimAmount.toString(),
      contractId,
    });

    return res.json({
      success: true,
      queued: true,
      jobId: job.id,
      claimAmount: claimAmount.toString(),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const rpcServer = new rpc.Server(RPC_URL);
const horizonServer = new Horizon.Server(HORIZON_URL);

// ─── Gasless Sponsorship Endpoints ───────────────────────────────────────────
// These operate on a completely separate state domain from streams, campaigns,
// and Socket.IO — no shared mutable state.

/**
 * GET /api/sponsor-status
 * Does a live balance check each call — reflects funding instantly.
 * Returns whether the sponsor is currently available and its XLM balance.
 */
app.get('/api/sponsor-status', async (_req, res) => {
  try {
    const sponsorKp = getSponsorKeypair();
    // Use Horizon (not Soroban RPC) — only Horizon returns balances[]
    const acct = await horizonServer.loadAccount(sponsorKp.publicKey());
    const xlm = parseFloat(
      acct.balances.find((b) => b.asset_type === 'native')?.balance ?? '0'
    );
    setSponsorAvailable(xlm >= 5);
    return res.json({ available: xlm >= 5, balance: xlm });
  } catch {
    setSponsorAvailable(false);
    return res.json({ available: false, balance: 0 });
  }
});


/**
 * POST /api/sponsor-tx
 * Accepts a signed inner Soroban transaction XDR, validates it, re-simulates
 * server-side, wraps it in a FeeBumpTransaction, and submits to the network.
 *
 * Body: { innerTxXdr: string, userAddress: string }
 * Returns: { success: true, txHash: string }
 */
app.post('/api/sponsor-tx', async (req, res) => {
  if (!sponsorAvailable) {
    return res.status(503).json({
      error: 'Gas sponsorship is temporarily unavailable. Please donate normally.',
      fallback: true,
    });
  }

  const { innerTxXdr, userAddress } = req.body ?? {};
  if (!innerTxXdr || !userAddress) {
    return res.status(400).json({ error: 'Missing required fields: innerTxXdr, userAddress' });
  }

  try {
    // Rate-limit check (IP + wallet address)
    checkRateLimit(req, userAddress);

    // Validate + server-side re-simulate the inner transaction
    const innerTx = await validateInnerTx(innerTxXdr, userAddress);

    // Build and sign the fee-bump, then submit
    const feeBump = buildFeeBump(innerTx);
    const sendRes = await rpcServer.sendTransaction(feeBump);

    if (sendRes.status === 'ERROR') {
      throw new Error('Fee-bump transaction rejected by Stellar network.');
    }

    // Poll for confirmation — no auto-retry on failure (matches README promise)
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

    console.log(`[Sponsor] Fee-bumped tx confirmed: ${sendRes.hash} for ${userAddress}`);
    return res.json({ success: true, txHash: sendRes.hash });

  } catch (err) {
    const status = err.status === 429 ? 429 : 400;
    console.warn(`[Sponsor] Request rejected: ${err.message}`);
    return res.status(status).json({
      error: err.message,
      fallback: status === 429, // signal the frontend to fall back to normal flow
    });
  }
});

// ─── Sponsor Balance Monitor ──────────────────────────────────────────────────
// Checks every 5 minutes. Suspends sponsorship when balance drops below 5 XLM.
async function checkSponsorBalance() {
  try {
    const sponsorKp = getSponsorKeypair();
    // Use Horizon — Soroban RPC getAccount() does not return balances
    const acct = await horizonServer.loadAccount(sponsorKp.publicKey());
    const xlm = parseFloat(
      acct.balances.find((b) => b.asset_type === 'native')?.balance ?? '0'
    );
    if (xlm < 5) {
      setSponsorAvailable(false);
      console.warn(`[Sponsor] LOW BALANCE: ${xlm} XLM — sponsorship suspended until recharged.`);
    } else {
      setSponsorAvailable(true);
      console.log(`[Sponsor] Balance OK: ${xlm} XLM — sponsorship active.`);
    }
  } catch {
    setSponsorAvailable(false);
  }
}

// Run once on startup, then every 5 minutes
checkSponsorBalance();
setInterval(checkSponsorBalance, 5 * 60 * 1000);

// Track campaigns that clients are actively viewing
const activeCampaigns = new Set();
let lastCheckedLedger = 0;

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Crowdfunding campaign subscription
  socket.on('subscribe_campaign', (contractId) => {
    socket.join(contractId);
    activeCampaigns.add(contractId);
    console.log(`Socket ${socket.id} subscribed to ${contractId}`);
  });

  // Streaming escrow room subscription
  socket.on('subscribe_stream', (streamId) => {
    const room = `stream:${streamId}`;
    socket.join(room);
    console.log(`Socket ${socket.id} subscribed to ${room}`);
    const snap = getStreamSnapshot(streamId);
    if (snap) {
      socket.emit('stream:snapshot', snap);
    }
  });

  socket.on('unsubscribe_stream', (streamId) => {
    const room = `stream:${streamId}`;
    socket.leave(room);
    console.log(`Socket ${socket.id} unsubscribed from ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// 10-second heartbeat loop to resync streaming balances across clients
setInterval(() => {
  if (streams.size === 0) return;
  for (const [streamId, stream] of streams.entries()) {
    if (stream.status !== 'settled') {
      const snap = getStreamSnapshot(streamId);
      io.to(`stream:${streamId}`).emit('stream:heartbeat', snap);
    }
  }
}, 10000);

// Polling loop
setInterval(async () => {
  if (activeCampaigns.size === 0) return;

  try {
    const latestLedger = await rpcServer.getLatestLedger();
    if (!latestLedger || !latestLedger.sequence) return;
    
    const currentSeq = latestLedger.sequence;
    if (lastCheckedLedger === 0) {
        lastCheckedLedger = currentSeq - 10;
    }

    if (currentSeq > lastCheckedLedger) {
        const contractIds = Array.from(activeCampaigns);
        
        // rpcServer.getEvents allows up to 5 contractIds per filter
        // We'll just slice the first 5 for the demo, or loop chunks
        const chunks = [];
        for (let i = 0; i < contractIds.length; i += 5) {
            chunks.push(contractIds.slice(i, i + 5));
        }

        for (const chunk of chunks) {
            const eventsRes = await rpcServer.getEvents({
                startLedger: lastCheckedLedger + 1,
                filters: [
                    {
                        type: 'contract',
                        contractIds: chunk,
                    },
                ],
                limit: 100,
            });

            if (eventsRes && eventsRes.events) {
                eventsRes.events
                .filter((e) => e.type === 'contract' && e.inSuccessfulContractCall)
                .forEach((e) => {
                    try {
                        const topic0 = scValToNative(e.topic[0]);
                        if (topic0 === 'donate') {
                            const donor = scValToNative(e.topic[1]);
                            const amountStroops = scValToNative(e.value);
                            const amount = (Number(amountStroops) / 10000000).toString();
                            
                            // Ensure campaignId is a clean string contract address
                            const rawId = e.contractId;
                            const campaignId = typeof rawId === 'string'
                              ? rawId
                              : (rawId && typeof rawId.contractId === 'function')
                              ? rawId.contractId()
                              : (rawId && typeof rawId.address === 'function')
                              ? rawId.address().toString()
                              : String(rawId);
                            
                            const donationEvent = {
                                campaignId,
                                donor: donor.toString(),
                                amount,
                                ledger: e.ledger,
                                txHash: e.txHash,
                                timestamp: e.ledgerClosedAt,
                            };

                            console.log('Emitting new_donation:', donationEvent);
                            // Emit to clients in this campaign's room
                            io.to(campaignId).emit('new_donation', donationEvent);
                            // Also broadcast globally so all clients get it if they want
                            io.emit('new_donation', donationEvent);
                        }
                    } catch (err) {
                        console.error('Error parsing event', err);
                    }
                });
            }
        }
        lastCheckedLedger = currentSeq;
    }
  } catch (error) {
    console.error('Error polling RPC:', error.message);
  }
}, 5000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend Socket.IO server running on port ${PORT}`);
  startWorker(io);
});
