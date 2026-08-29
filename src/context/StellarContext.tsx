/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, ReactNode, useCallback } from "react";
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { rpcServer, server, CROWDFUND_CONTRACT_ID } from '../config';
import { useToast } from '../components/Toast';
import {
  fetchCampaignStateData,
  fetchRecentEventsData,
  CampaignState,
  DonationEvent,
} from '../hooks/useCrowdfundingContract';
import { useFactoryContract } from '../hooks/useFactoryContract';

StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: 'freighter',
  modules: [new FreighterModule(), new AlbedoModule(), new xBullModule()],
});

export type { CampaignState, DonationEvent };

export interface CustomCampaign {
  id: string;
  title: string;
  addedAt: number;
}

interface StellarContextType {
  isConnecting: boolean;
  pubKey: string;
  balance: string | null;
  appError: string;
  campaign: CampaignState | null;
  recentDonations: DonationEvent[];
  activeContractId: string;
  globalCampaigns: CustomCampaign[];
  setActiveContractId: (id: string) => void;
  fetchGlobalCampaigns: () => Promise<void>;
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
  
  const [activeContractId, setActiveContractIdState] = useState(() => {
    // Read from URL query param if present, else localStorage, else default
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('campaign');
    if (queryId) return queryId;
    return localStorage.getItem('activeContractId') || CROWDFUND_CONTRACT_ID;
  });

  const [globalCampaigns, setGlobalCampaigns] = useState<CustomCampaign[]>([]);
  const { fetchAllCampaigns, fetchCampaignMetadata } = useFactoryContract();

  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [recentDonations, setRecentDonations] = useState<DonationEvent[]>([]);

  const setActiveContractId = useCallback((id: string) => {
    setActiveContractIdState(id);
    localStorage.setItem('activeContractId', id);
    
    // Update URL without reloading page
    const url = new URL(window.location.href);
    if (id === CROWDFUND_CONTRACT_ID) {
      url.searchParams.delete('campaign');
    } else {
      url.searchParams.set('campaign', id);
    }
    window.history.pushState({}, '', url);

    // Hard reset state immediately to prevent visual flashing of old data
    setCampaign(null);
    setRecentDonations([]);
  }, []);

  const fetchGlobalCampaigns = useCallback(async () => {
    try {
      const addresses = await fetchAllCampaigns(0, 100);
      const campaigns: CustomCampaign[] = [];
      for (const address of addresses) {
        const meta = await fetchCampaignMetadata(address);
        if (meta) {
          campaigns.push({
            id: meta.address,
            title: meta.title,
            addedAt: meta.createdAt,
          });
        }
      }
      setGlobalCampaigns(campaigns.sort((a, b) => b.addedAt - a.addedAt));
    } catch (e) {
      console.error("Failed to fetch global campaigns", e);
    }
  }, [fetchAllCampaigns, fetchCampaignMetadata]);

  const fetchCampaignState = useCallback(async () => {
    try {
      const state = await fetchCampaignStateData(activeContractId);
      if (state) {
        setCampaign(state);
      }
    } catch (e) {
      console.error("Failed to fetch campaign state:", e);
    }
  }, [activeContractId]);

  const fetchRecentEvents = useCallback(async (startLedger: number) => {
    try {
      // Capture the requested ID to prevent stale closures
      const requestedContractId = activeContractId;
      const result = await fetchRecentEventsData(requestedContractId, startLedger);
      
      if (result && result.events && result.events.length > 0) {
        setRecentDonations((prev) => {
          // Guard: if activeContractId changed mid-flight, discard these events!
          // We can't access current state inside setRecentDonations directly 
          // without a ref, but fetchRecentEvents is recreated when activeContractId changes.
          // By the time it resolves, if we still call setter, we might overwrite.
          // In the caller (useEffect), we enforce the activeContractId check before applying.
          return [...result.events.reverse(), ...prev].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
        });
        return true;
      }
      return false;
    } catch (e: any) {
      console.error("Failed to fetch events:", e?.message || e);
      return false;
    }
  }, [activeContractId]);

  // Polling with scoped exponential backoff and cursor tracking
  useEffect(() => {
    let isMounted = true;
    let lastCheckedLedger = 0;
    let pollIntervalMs = 5000;
    let pollTimeoutId: ReturnType<typeof setTimeout>;

    // We capture the currently active contract ID for this specific useEffect instance
    const pollingContractId = activeContractId;

    const poll = async () => {
      if (!isMounted) return;

      try {
        const state = await fetchCampaignStateData(pollingContractId);
        
        // Guard against stale closure / unmounted
        if (!isMounted || activeContractId !== pollingContractId) return;

        if (state) {
          setCampaign(state);
        }

        const latestLedger = await rpcServer.getLatestLedger();
        if (isMounted && activeContractId === pollingContractId && latestLedger && latestLedger.sequence) {
          const currentSeq = latestLedger.sequence;
          
          let fetchedEvents: { events: DonationEvent[]; latestLedger?: number } = { events: [] };
          
          if (lastCheckedLedger === 0) {
            // Initial load: check recent ledgers to populate live activity feed
            fetchedEvents = await fetchRecentEventsData(pollingContractId, Math.max(1, currentSeq - 1000));
          } else if (currentSeq > lastCheckedLedger) {
            // Use lastCheckedLedger + 1 as pagination cursor
            fetchedEvents = await fetchRecentEventsData(pollingContractId, lastCheckedLedger + 1);
          }

          // Guard against stale closure AFTER async fetch completes
          if (isMounted && activeContractId === pollingContractId && fetchedEvents.events.length > 0) {
            setRecentDonations((prev) => {
              const combined = [...fetchedEvents.events.reverse(), ...prev];
              return combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            });
          }

          if (isMounted && activeContractId === pollingContractId) {
             lastCheckedLedger = currentSeq;
          }
        }

        // On successful poll, reset backoff to normal 5s interval
        pollIntervalMs = 5000;
      } catch (e) {
        console.error("Polling error (applying scoped backoff):", e);
        // Scoped backoff on read polling only: 5s -> 10s -> 20s -> max 30s
        pollIntervalMs = Math.min(pollIntervalMs * 2, 30000);
      }

      if (isMounted && activeContractId === pollingContractId) {
        pollTimeoutId = setTimeout(poll, pollIntervalMs);
      }
    };

    // Hard reset on dependency change
    setCampaign(null);
    setRecentDonations([]);
    
    poll();

    return () => {
      isMounted = false;
      clearTimeout(pollTimeoutId);
    };
  }, [activeContractId]);

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

  useEffect(() => {
    fetchGlobalCampaigns();
  }, [fetchGlobalCampaigns]);

  const addDonationEvent = useCallback((event: DonationEvent) => {
    setRecentDonations((prev) => {
      const exists = prev.some((d) => d.id === event.id);
      if (exists) return prev;
      return [event, ...prev];
    });
  }, []);

  return (
    <StellarContext.Provider value={{
      pubKey, balance, isConnecting, appError, campaign, recentDonations, 
      activeContractId, globalCampaigns, setActiveContractId, fetchGlobalCampaigns,
      connectWallet, disconnectWallet, fetchBalance, fetchCampaignState, addDonationEvent
    }}>
      {children}
    </StellarContext.Provider>
  );
}
