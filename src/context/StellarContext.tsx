/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { TransactionBuilder, Contract, rpc, scValToNative, Account, Keypair } from "@stellar/stellar-sdk";
import { CONTRACT_ID, rpcServer, server, NETWORK_PASSPHRASE } from '../config';
import { useToast } from '../components/Toast';

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
  isConnecting: boolean;
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

export const StellarContext = createContext<StellarContextType | undefined>(undefined);

export function StellarProvider({ children }: { children: ReactNode }) {
  const [pubKey, setPubKey] = useState(() => localStorage.getItem('stellarPubKey') || '');
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [appError, setAppError] = useState('');
  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [recentDonations, setRecentDonations] = useState<DonationEvent[]>([]);

  const fetchCampaignState = async () => {
    try {
      const dummyAccount = new Account(Keypair.random().publicKey(), '0');
      const contract = new Contract(CONTRACT_ID);
      const tx = new TransactionBuilder(dummyAccount, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
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
        limit: 100,
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
            const combined = [...parsedEvents.reverse(), ...prev];
            // Deduplicate by id
            const unique = combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            return unique;
          });
        }
        return true;
      }
    } catch (e: any) {
      console.error("Failed to fetch events:", e?.message || e);
      return false;
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchCampaignState();
    
    // Polling setup
    let isMounted = true;
    let lastCheckedLedger = 0;

    const poll = async () => {
      if (!isMounted) return;
      try {
        await // eslint-disable-next-line react/set-state-in-effect
    fetchCampaignState();
        
        const latestLedger = await rpcServer.getLatestLedger();
        if (latestLedger.sequence) {
          const currentSeq = latestLedger.sequence;
          if (lastCheckedLedger === 0) {
            // First time, check last 100 ledgers to populate recent activity
            await fetchRecentEvents(Math.max(1, currentSeq - 10000));
            let success = await fetchRecentEvents(Math.max(1, currentSeq - 10000));
            if (!success) {
              success = await fetchRecentEvents(Math.max(1, currentSeq - 1000));
              if (!success) {
                 await fetchRecentEvents(currentSeq - 100);
              }
            }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBalance = async (publicKey: string) => {
    try {
      const account = await server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      setBalance(nativeBalance ? nativeBalance.balance : "0");
    } catch {
      setBalance("Not Funded");
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setAppError('');
    try {
      const { address } = await StellarWalletsKit.authModal();
      if (address) {
        setPubKey(address);
        localStorage.setItem('stellarPubKey', address);
        toast("Wallet connected successfully", "success");
        fetchBalance(address);
      }
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.toLowerCase() || '';
      if (msg.includes('not installed') || msg.includes('not found')) {
        setAppError("Wallet not found. Please install the required extension.");
        toast("Wallet not found", "error");
      } else {
        setAppError("Connection failed or user rejected the request.");
        toast("Connection rejected", "error");
      }
    } finally {
      setIsConnecting(false);
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
      // eslint-disable-next-line react/set-state-in-effect
      fetchBalance(pubKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StellarContext.Provider value={{
      pubKey, balance, isConnecting, appError, campaign, recentDonations, connectWallet, disconnectWallet, fetchBalance, fetchCampaignState
    }}>
      {children}
    </StellarContext.Provider>
  );
}


