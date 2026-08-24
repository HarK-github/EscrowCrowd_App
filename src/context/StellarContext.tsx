import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { Horizon, TransactionBuilder, Networks as StellarNetworks, Contract, rpc, scValToNative, Account, Keypair, nativeToScVal } from '@stellar/stellar-sdk';

export const CONTRACT_ID = 'CAKBK6LDUAYFCIGDMGWGYEXDSRSVCLDJDUXHOSCS2BQYBNZLS3NPFRQS';
export const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org:443');
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE = StellarNetworks.TESTNET;
export const server = new Horizon.Server(HORIZON_URL);

StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: 'freighter',
  modules: [new FreighterModule(), new AlbedoModule(), new xBullModule()],
});

export interface CampaignState {
  creator: string;
  deadline: number;
  goal: number;
  status: string;
  token: string;
  totalRaised: number;
}

export interface DonationEvent {
  id: string;
  donor: string;
  amount: number;
  timestamp: string;
}

interface StellarContextType {
  pubKey: string;
  balance: string | null;
  appError: string;
  campaign: CampaignState | null;
  recentDonations: DonationEvent[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  fetchBalance: (publicKey: string) => Promise<void>;
  fetchCampaignState: () => Promise<void>;
}

const StellarContext = createContext<StellarContextType | undefined>(undefined);

export function StellarProvider({ children }: { children: ReactNode }) {
  const [pubKey, setPubKey] = useState(() => localStorage.getItem('stellarPubKey') || '');
  const [balance, setBalance] = useState<string | null>(null);
  const [appError, setAppError] = useState('');
  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [recentDonations, setRecentDonations] = useState<DonationEvent[]>([]);

  const fetchCampaignState = async () => {
    try {
      const dummyAccount = new Account(Keypair.random().publicKey(), '0');
      const contract = new Contract(CONTRACT_ID);
      const tx = new TransactionBuilder(dummyAccount, { fee: '100', networkPassphrase: StellarNetworks.TESTNET })
        .addOperation(contract.call('get_campaign_state'))
        .setTimeout(30)
        .build();

      const response = await rpcServer.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(response)) {
        console.error("Simulation error:", response.error);
        return;
      }
      if (rpc.Api.isSimulationSuccess(response)) {
        const resultVal = response.result.retval;
        const state = scValToNative(resultVal);

        setCampaign({
          creator: state.creator,
          deadline: Number(state.deadline),
          goal: Number(state.goal) / 10000000,
          status: state.status,
          token: state.token,
          totalRaised: Number(state.total_raised) / 10000000,
        });
      }
    } catch (e) {
      console.error("Failed to fetch campaign state:", e);
    }
  };

  const fetchRecentEvents = async (startLedger: number) => {
    try {
      const eventsRes = await rpcServer.getEvents({
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID],
          },
        ],
        limit: 10,
      });

      if (eventsRes && eventsRes.events) {
        const parsedEvents = eventsRes.events
          .filter((e) => e.type === 'contract' && e.inSuccessfulContractCall)
          .map((e) => {
            try {
              const topic0 = scValToNative(e.topic[0]);
              if (topic0 === 'donate') {
                const donor = scValToNative(e.topic[1]);
                const amountStroops = scValToNative(e.value);
                const amount = Number(amountStroops) / 10000000;
                return {
                  id: e.id,
                  donor: donor.toString(),
                  amount,
                  timestamp: e.ledgerClosedAt,
                };
              }
            } catch (err) {
              console.error("Error parsing event", err);
            }
            return null;
          })
          .filter(Boolean) as DonationEvent[];

        if (parsedEvents.length > 0) {
          setRecentDonations((prev) => {
            const combined = [...parsedEvents, ...prev];
            // Deduplicate by id
            const unique = combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            return unique.slice(0, 10); // Keep last 10
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch events:", e);
    }
  };

  useEffect(() => {
    fetchCampaignState();
    
    // Polling setup
    let isMounted = true;
    let lastCheckedLedger = 0;

    const poll = async () => {
      if (!isMounted) return;
      try {
        await fetchCampaignState();
        
        const latestLedger = await rpcServer.getLatestLedger();
        if (latestLedger.sequence) {
          const currentSeq = latestLedger.sequence;
          if (lastCheckedLedger === 0) {
            // First time, check last 100 ledgers to populate recent activity
            await fetchRecentEvents(currentSeq - 100);
          } else if (currentSeq > lastCheckedLedger) {
            await fetchRecentEvents(lastCheckedLedger);
          }
          lastCheckedLedger = currentSeq;
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
      
      if (isMounted) {
        setTimeout(poll, 5000); // Poll every 5 seconds
      }
    };

    poll();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchBalance = async (publicKey: string) => {
    try {
      const account = await server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      setBalance(nativeBalance ? nativeBalance.balance : "0");
    } catch (e) {
      setBalance("Not Funded");
    }
  };

  const connectWallet = async () => {
    setAppError('');
    try {
      const { address } = await StellarWalletsKit.authModal();
      if (address) {
        setPubKey(address);
        localStorage.setItem('stellarPubKey', address);
        fetchBalance(address);
      }
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.toLowerCase() || '';
      if (msg.includes('not installed') || msg.includes('not found')) {
        setAppError("Wallet not found. Please install the required extension.");
      } else {
        setAppError("Connection rejected or failed.");
      }
    }
  };

  const disconnectWallet = () => {
    setPubKey('');
    setBalance(null);
    localStorage.removeItem('stellarPubKey');
  };

  // Fetch balance on initial load if pubKey exists
  useEffect(() => {
    if (pubKey) {
      fetchBalance(pubKey);
    }
  }, []);

  return (
    <StellarContext.Provider value={{
      pubKey, balance, appError, campaign, recentDonations, connectWallet, disconnectWallet, fetchBalance, fetchCampaignState
    }}>
      {children}
    </StellarContext.Provider>
  );
}

export function useStellar() {
  const context = useContext(StellarContext);
  if (context === undefined) {
    throw new Error('useStellar must be used within a StellarProvider');
  }
  return context;
}
