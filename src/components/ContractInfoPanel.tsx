import React, { useState } from 'react';
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
