/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, ReactNode, useCallback } from "react";
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { rpcServer, server } from '../config';
import { useToast } from '../components/Toast';
import {
  fetchCampaignStateData,
  fetchRecentEventsData,
  CampaignState,
  DonationEvent,
} from '../hooks/useCrowdfundingContract';

StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: 'freighter',
  modules: [new FreighterModule(), new AlbedoModule(), new xBullModule()],
});

export type { CampaignState, DonationEvent };

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
  addDonationEvent: (event: DonationEvent) => void;
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

  const fetchCampaignState = useCallback(async () => {
    try {
      const state = await fetchCampaignStateData();
      if (state) {
        setCampaign(state);
      }
    } catch (e) {
      console.error("Failed to fetch campaign state:", e);
    }
  }, []);

  const fetchRecentEvents = useCallback(async (startLedger: number) => {
    try {
      const result = await fetchRecentEventsData(startLedger);
      if (result && result.events && result.events.length > 0) {
        setRecentDonations((prev) => {
          const combined = [...result.events.reverse(), ...prev];
          // Deduplicate by id
          return combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
        });
        return true;
      }
      return false;
    } catch (e: any) {
      console.error("Failed to fetch events:", e?.message || e);
      return false;
    }
  }, []);

  // Polling with scoped exponential backoff and cursor tracking
  useEffect(() => {
    let isMounted = true;
    let lastCheckedLedger = 0;
    let pollIntervalMs = 5000;
    let pollTimeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!isMounted) return;

      try {
        const state = await fetchCampaignStateData();
        if (isMounted && state) {
          setCampaign(state);
        }

        const latestLedger = await rpcServer.getLatestLedger();
        if (isMounted && latestLedger && latestLedger.sequence) {
          const currentSeq = latestLedger.sequence;
          if (lastCheckedLedger === 0) {
            // Initial load: check recent ledgers to populate live activity feed
            await fetchRecentEvents(Math.max(1, currentSeq - 1000));
          } else if (currentSeq > lastCheckedLedger) {
            // Use lastCheckedLedger + 1 as pagination cursor to avoid duplicate ledger querying
            await fetchRecentEvents(lastCheckedLedger + 1);
          }
          lastCheckedLedger = currentSeq;
        }

        // On successful poll, reset backoff to normal 5s interval
        pollIntervalMs = 5000;
      } catch (e) {
        console.error("Polling error (applying scoped backoff):", e);
        // Scoped backoff on read polling only: 5s -> 10s -> 20s -> max 30s
        pollIntervalMs = Math.min(pollIntervalMs * 2, 30000);
      }

      if (isMounted) {
        pollTimeoutId = setTimeout(poll, pollIntervalMs);
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(pollTimeoutId);
    };
  }, [fetchRecentEvents]);

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

  const addDonationEvent = useCallback((event: DonationEvent) => {
    setRecentDonations((prev) => {
      const exists = prev.some((d) => d.id === event.id);
      if (exists) return prev;
      return [event, ...prev];
    });
  }, []);

  return (
    <StellarContext.Provider value={{
      pubKey, balance, isConnecting, appError, campaign, recentDonations, connectWallet, disconnectWallet, fetchBalance, fetchCampaignState, addDonationEvent
    }}>
      {children}
    </StellarContext.Provider>
  );
}
