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
  CROWDFUND_CONTRACT_ID,
  REWARD_BADGE_CONTRACT_ID,
  NETWORK_LABEL,
  VERIFIED_TRANSACTIONS,
  getExplorerContractUrl,
  getExplorerTxUrl,
} from '../config/contracts';
import { rpcServer } from '../config';

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
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>On-Chain Contract Transparency</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono hidden sm:inline">
                Dual-Contract System
              </span>
            </div>
            <p className="text-xs text-neutral-400 hidden sm:block">
              Verify Soroban smart contract addresses & live testnet deployment proofs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Network / Live status badge */}
          <div className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
            {isRpcLive && latestLedger ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="hidden md:inline text-neutral-400">Ledger #{latestLedger}</span>
                <span className="md:hidden">Live</span>
              </>
            ) : (
              <>
                <Radio size={12} className="text-neutral-400" />
                <span>{NETWORK_LABEL}</span>
              </>
            )}
          </div>

          <span className="text-neutral-400 p-1 rounded-md hover:bg-white/10">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 border-t border-white/10 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Crowdfunding Contract Card */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Crowdfund Escrow Contract</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Primary
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-3">
                  Handles escrow vault logic, milestone tracking, deadline enforcement, and refunds.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-neutral-400 font-medium">Contract Address:</div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-neutral-200">
                  <span title={CROWDFUND_CONTRACT_ID} className="truncate">
                    {truncateAddress(CROWDFUND_CONTRACT_ID)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(CROWDFUND_CONTRACT_ID, 'crowdfund_addr')}
                      title="Copy Address"
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                      aria-label="Copy Crowdfund Contract Address"
                    >
                      {copiedKey === 'crowdfund_addr' ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <a
                      href={getExplorerContractUrl(CROWDFUND_CONTRACT_ID)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on Stellar Expert"
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                      aria-label="View Crowdfund Contract on Stellar Expert"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Deployment Tx */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-neutral-400">Deploy Transaction:</span>
                <a
                  href={getExplorerTxUrl(VERIFIED_TRANSACTIONS.crowdfundDeployTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  {truncateHash(VERIFIED_TRANSACTIONS.crowdfundDeployTx)}
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Reward Badge Contract Card */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-amber-400" />
                    <span className="text-sm font-semibold text-white">RewardBadge Contract</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Inter-Contract
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-3">
                  Autonomous NFT/badge minter invoked cross-contract when donations exceed 100 XLM.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-neutral-400 font-medium">Contract Address:</div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-neutral-200">
                  <span title={REWARD_BADGE_CONTRACT_ID} className="truncate">
                    {truncateAddress(REWARD_BADGE_CONTRACT_ID)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(REWARD_BADGE_CONTRACT_ID, 'badge_addr')}
                      title="Copy Address"
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                      aria-label="Copy Reward Badge Contract Address"
                    >
                      {copiedKey === 'badge_addr' ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <a
                      href={getExplorerContractUrl(REWARD_BADGE_CONTRACT_ID)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on Stellar Expert"
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                      aria-label="View Reward Badge Contract on Stellar Expert"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Cross-contract Tx */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-neutral-400">Cross-Contract Proof Tx:</span>
                <a
                  href={getExplorerTxUrl(VERIFIED_TRANSACTIONS.crossContractBadgeTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-amber-400 hover:underline inline-flex items-center gap-1"
                >
                  {truncateHash(VERIFIED_TRANSACTIONS.crossContractBadgeTx)}
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>

          {/* Footer verification summary */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-neutral-400" />
              <span>
                Network: <strong className="text-white font-mono">{NETWORK_LABEL}</strong>
              </span>
            </div>
            <span className="text-neutral-500 text-[11px]">
              All smart contract calls execute trustlessly on Stellar Soroban testnet.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
