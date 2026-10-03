import { useState, useEffect } from 'react';
import { getExplorerContractUrl } from '../config';
import { useFactoryContract } from '../hooks/useCrowdfundingContract';

function ContractDetails() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const { fetchAllCampaigns } = useFactoryContract();

  useEffect(() => {
    const loadContracts = async () => {
      const all = await fetchAllCampaigns();
      setCampaigns(all);
    };
    loadContracts();
    
    const interval = setInterval(loadContracts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAllCampaigns]);

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

  return (
    <div className="px-5 pb-5 pt-2 border-t border-white/10">
      <div className="text-xs text-neutral-400 mb-4">
        {campaigns.length} active campaigns found on the network.
      </div>
      
      <div className="max-h-64 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {campaigns.length === 0 ? (
          <div className="text-xs text-neutral-500 italic py-2">No campaigns found.</div>
        ) : (
          campaigns.map((addr, idx) => (
            <div key={addr} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-neutral-200">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 w-4">{idx + 1}.</span>
                <span title={addr} className="truncate">{truncateAddress(addr)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(addr, `camp_${addr}`)}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                >
                  {copiedKey === `camp_${addr}` ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={getExplorerContractUrl(addr)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                >
                  Explorer
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface ContractInfoPanelProps {
  defaultExpanded?: boolean;
  className?: string;
}

export function ContractInfoPanel({
  defaultExpanded = false,
  className = '',
}: ContractInfoPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

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
