import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { rpc, scValToNative } from '@stellar/stellar-sdk';
import 'dotenv/config';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const rpcServer = new rpc.Server(RPC_URL);

// Track campaigns that clients are actively viewing
const activeCampaigns = new Set();
let lastCheckedLedger = 0;

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // When a client views a campaign, they join a room for it
  socket.on('subscribe_campaign', (contractId) => {
    socket.join(contractId);
    activeCampaigns.add(contractId);
    console.log(`Socket ${socket.id} subscribed to ${contractId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

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
                            const campaignId = e.contractId;
                            
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
});
