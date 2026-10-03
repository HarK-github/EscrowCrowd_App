import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { rpc, Horizon, scValToNative } from '@stellar/stellar-sdk';
import 'dotenv/config';
import { enqueueSponsorTx } from './queue.js';
import { startWorker } from './worker.js';
import { getSponsorKeypair, sponsorAvailable, setSponsorAvailable, checkRateLimit } from './sponsor.js';

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

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const rpcServer = new rpc.Server(RPC_URL);
const horizonServer = new Horizon.Server(HORIZON_URL);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    sponsorAvailable,
  });
});

// ─── Gasless Sponsorship Endpoints ───────────────────────────────────────────
/**
 * GET /api/sponsor-status
 * Returns whether the sponsor is currently available and its XLM balance.
 */
app.get('/api/sponsor-status', async (_req, res) => {
  try {
    const sponsorKp = getSponsorKeypair();
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
 * Accepts a signed inner Soroban transaction XDR, validates it,
 * queues it for serialized execution (protecting RPC limits), and returns the confirmed txHash.
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
    // 1. Rate-limit check (IP + wallet address)
    checkRateLimit(req, userAddress);

    // 2. Process through the serialized queue
    const result = await enqueueSponsorTx({ innerTxXdr, userAddress });
    return res.json(result);

  } catch (err) {
    const status = err.status === 429 ? 429 : 400;
    console.warn(`[Sponsor] Request rejected or failed: ${err.message}`);
    return res.status(status).json({
      error: err.message,
      fallback: status === 429,
    });
  }
});

// ─── Sponsor Balance Monitor ──────────────────────────────────────────────────
// Checks every 5 minutes. Suspends sponsorship when balance drops below 5 XLM.
async function checkSponsorBalance() {
  try {
    const sponsorKp = getSponsorKeypair();
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

// ─── Real-time Campaign WebSockets & Polling Loop ─────────────────────────────
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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Polling loop for on-chain donation events
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
                  io.to(campaignId).emit('new_donation', donationEvent);
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
  console.log(`Backend server running on port ${PORT}`);
  startWorker();
});

export { app, server };
