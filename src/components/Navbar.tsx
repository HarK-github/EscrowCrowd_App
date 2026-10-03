import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, LogOut, ChevronDown, PlusCircle, Rocket, Compass } from 'lucide-react';
import { useStellar } from '../context/StellarContext';
import { CROWDFUND_CONTRACT_ID } from '../config';
import { CreateCampaignModal, BrowseCampaignsModal } from './CampaignModals';

export function Navbar() {
  const { pubKey, balance, connectWallet, disconnectWallet, activeContractId, globalCampaigns, setActiveContractId } = useStellar();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const activeTitle = activeContractId === CROWDFUND_CONTRACT_ID 
    ? 'Official Campaign' 
    : globalCampaigns.find(c => c.id === activeContractId)?.title || 'Custom Campaign';

  return (
    <nav className="px-4 sm:px-8 md:px-12 lg:px-28 py-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 z-50 relative border-b border-white/5 bg-background">
      <div className="flex items-center justify-between w-full md:w-auto gap-4 sm:gap-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight">EscrowCrowd</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap md:flex-nowrap">
          {!pubKey && (
            <>
              <a href="#" className="hidden md:block px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">How it works</a>
              <a href="#" className="hidden md:block px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">Campaigns</a>
            </>
          )}
          {pubKey && !isDashboard && (
            <Link to="/dashboard" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">
              Dashboard
            </Link>
          )}
          {pubKey && isDashboard && (
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium hover:bg-white/5 rounded-lg transition-colors border border-white/10 max-w-[150px] sm:max-w-none"
              >
                <span className="truncate">{activeTitle}</span>
                <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isDropdownOpen && (
                <div className="absolute top-full mt-2 w-56 bg-[#0c1015] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 z-50">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Campaign</div>
                  
                  <button 
                    onClick={() => { setActiveContractId(CROWDFUND_CONTRACT_ID); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 ${activeContractId === CROWDFUND_CONTRACT_ID ? 'text-accent' : ''}`}
                  >
                    Official Campaign
                  </button>
                  
                  {globalCampaigns.length > 0 && <div className="h-px bg-white/10 my-1 mx-3" />}
                  
                  {globalCampaigns.slice(0, 5).map(c => (
                    <button 
                      key={c.id}
                      onClick={() => { setActiveContractId(c.id); setIsDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 truncate ${activeContractId === c.id ? 'text-accent' : ''}`}
                      title={c.id}
                    >
                      {c.title}
                    </button>
                  ))}
                  
                  <div className="h-px bg-white/10 my-1 mx-3" />
                  
                  <button 
                    onClick={() => { setIsCampaignModalOpen(true); setIsDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 text-emerald-400"
                  >
                    <PlusCircle size={16} /> Launch New...
                  </button>
                  <button 
                    onClick={() => { setIsBrowseModalOpen(true); setIsDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 text-blue-400"
                  >
                    <Compass size={16} /> Browse All Campaigns...
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 sm:gap-4 w-full md:w-auto mt-2 md:mt-0">
        {pubKey && !isDashboard && (
          <button 
            onClick={() => setIsCampaignModalOpen(true)}
            className="hidden md:flex bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors items-center gap-2 border border-white/5"
          >
            <Rocket size={16} /> Launch Campaign
          </button>
        )}
        
        {pubKey ? (
          <>
            {/* Mobile compact wallet badge */}
            <div className="flex sm:hidden items-center border border-white/10 bg-black/40 rounded-full py-1 px-2.5 backdrop-blur-md text-xs">
              <span className="font-mono text-[11px] mr-1.5 pr-1.5 border-r border-white/20 text-neutral-300">
                {pubKey.slice(0, 4)}...{pubKey.slice(-3)}
              </span>
              <span className="font-semibold text-accent text-[11px]">
                {balance ? `${balance} XLM` : <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin inline-block"></div>}
              </span>
            </div>

            {/* Desktop wallet badge */}
            <div className="hidden sm:flex items-center border border-white/5 bg-transparent rounded-full py-1.5 px-4 backdrop-blur-md">
              <Wallet size={14} className="text-muted-foreground mr-2" />
              <span className="font-mono text-sm mr-3 border-r border-white/20 pr-3">
                {pubKey.slice(0, 5)}...{pubKey.slice(-4)}
              </span>
              <span className="font-semibold text-sm text-accent">
                {balance ? `${balance} XLM` : <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin inline-block"></div>}
              </span>
            </div>
            
            <button
              onClick={disconnectWallet}
              className="text-xs sm:text-sm font-medium bg-white/10 text-white backdrop-blur-md px-3 sm:px-4 py-1.5 min-h-[36px] sm:min-h-[40px] rounded-full hover:bg-white/20 transition-colors flex items-center justify-center shrink-0"
              title="Disconnect Wallet"
            >
              <LogOut size={16} className="sm:mr-2 hidden sm:block" />
              <span className="hidden sm:inline">Disconnect</span>
              <LogOut size={16} className="sm:hidden block" />
            </button>
          </>
        ) : (
          <button onClick={connectWallet} className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
            <Wallet size={16} /> Connect Wallet
          </button>
        )}
      </div>

      <CreateCampaignModal 
        isOpen={isCampaignModalOpen} 
        onClose={() => setIsCampaignModalOpen(false)} 
      />
      <BrowseCampaignsModal
        isOpen={isBrowseModalOpen}
        onClose={() => setIsBrowseModalOpen(false)}
      />
    </nav>
  );
}

