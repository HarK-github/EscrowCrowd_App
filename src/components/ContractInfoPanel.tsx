import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Award,
  Radio,
} from 'lucide-react';
import {
  NETWORK_LABEL,
} from '../config/contracts';
import { rpcServer } from '../config';
import { ContractDetails } from './ContractDetails';

interface ContractInfoPanelProps {
  defaultExpanded?: boolean;
  className?: string;
}

export function ContractInfoPanel({
  defaultExpanded = false,
  className = '',
}: ContractInfoPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [latestLedger, setLatestLedger] = useState<number | null>(null);
  const [isRpcLive, setIsRpcLive] = useState<boolean>(true);

  // Fetch latest ledger sequence gracefully
  useEffect(() => {
    let isMounted = true;

    const fetchLedger = async () => {
      try {
        const res = await rpcServer.getLatestLedger();
        if (isMounted && res && res.sequence) {
          setLatestLedger(res.sequence);
          setIsRpcLive(true);
        }
      } catch {
        if (isMounted) {
          // Graceful fallback: quiet fallback without UI breakage
          setIsRpcLive(false);
        }
      }
    };

    fetchLedger();
    const interval = setInterval(fetchLedger, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  const truncateHash = (hash: string) => {
    if (!hash || hash.length < 12) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <div
      data-testid="contract-info-panel"
      className={`w-full max-w-5xl mx-auto rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl ${className}`}
    >
      {/* Header / Toggle Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-white/20"
        aria-expanded={isExpanded}
        aria-label="Toggle contract transparency panel"
      >
        <div className="text-sm font-semibold text-white">
          Deployed Contracts
        </div>
        <div className="text-neutral-400 text-xs">
          {isExpanded ? 'Hide' : 'Show'}
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && <ContractDetails />}
    </div>
  );
}
