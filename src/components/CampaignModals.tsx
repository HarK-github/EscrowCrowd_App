import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Rocket,
  Loader2,
  ArrowRight,
  X,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useStellar } from '../context/StellarContext';
import {
  fetchCampaignStateData,
  CampaignState,
  useFactoryContract,
} from '../hooks/useCrowdfundingContract';
import { getExplorerContractUrl } from '../config';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrowseCampaignsModal({ isOpen, onClose }: ModalProps) {
  const { globalCampaigns, setActiveContractId } = useStellar();
  const navigate = useNavigate();
  const [campaignStates, setCampaignStates] = useState<Record<string, CampaignState>>({});
  const [isLoadingStates, setIsLoadingStates] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    
    async function loadStates() {
      if (globalCampaigns.length === 0) {
        setIsLoadingStates(false);
        return;
      }
      setIsLoadingStates(true);
      const states: Record<string, CampaignState> = {};
      
      await Promise.all(
        globalCampaigns.map(async (c) => {
          try {
            const state = await fetchCampaignStateData(c.id);
            if (state) {
              states[c.id] = state;
            }
          } catch (e) {
            console.error(`Failed to load state for ${c.id}`);
          }
        })
      );
      
      setCampaignStates(states);
      setIsLoadingStates(false);
    }
    
    loadStates();
  }, [globalCampaigns, isOpen]);

  if (!isOpen) return null;

  const handleSelectCampaign = (id: string) => {
    setActiveContractId(id);
    onClose();
    navigate('/dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="liquid-glass border border-white/10 rounded-2xl shadow-xl backdrop-blur-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-white/5 bg-white/[0.02]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Compass size={18} className="text-blue-400" /> Browse Campaigns
          </h2>
          <button 
            onClick={onClose} 
            className="text-muted-foreground hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto">
          {globalCampaigns.length === 0 ? (
            <div className="text-center flex flex-col items-center py-12">
              <Rocket className="text-muted-foreground mb-4 opacity-50" size={48} />
              <h3 className="text-xl font-semibold mb-2">No Campaigns Found</h3>
              <p className="text-muted-foreground max-w-md">
                There are currently no campaigns registered in the Factory contract.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {globalCampaigns.map((campaign) => {
                const state = campaignStates[campaign.id];
                const isLoaded = !!state;
                
                const goalXlm = isLoaded ? Number(state.goal) / 10000000 : 0;
                const raisedXlm = isLoaded ? Number(state.totalRaised) / 10000000 : 0;
                const progress = isLoaded ? Math.min(100, Math.max(0, (raisedXlm / goalXlm) * 100)) : 0;
                
                return (
                  <div 
                    key={campaign.id}
                    onClick={() => handleSelectCampaign(campaign.id)}
                    className="bg-black/20 border border-white/10 hover:border-accent/50 rounded-xl p-5 cursor-pointer group transition-all hover:bg-white/[0.02]"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-base line-clamp-1 group-hover:text-accent transition-colors">
                        {campaign.title}
                      </h3>
                    </div>
                    
                    <div className="text-[10px] text-muted-foreground font-mono mb-4 bg-white/5 p-1.5 rounded inline-block truncate max-w-full">
                      {campaign.id}
                    </div>
                    
                    {isLoadingStates && !isLoaded ? (
                      <div className="flex justify-center py-2">
                        <Loader2 className="animate-spin text-muted-foreground" size={20} />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-white font-semibold">{raisedXlm.toFixed(2)} XLM</span>
                            <span className="text-muted-foreground">of {goalXlm} XLM</span>
                          </div>
                          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-accent rounded-full transition-all duration-1000"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5 text-xs">
                          <div className="text-muted-foreground">
                            {new Date(campaign.addedAt).toLocaleDateString()}
                          </div>
                          <div className="text-accent flex items-center gap-1 font-semibold group-hover:translate-x-1 transition-transform">
                            View <ArrowRight size={14} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CreateCampaignModal({ isOpen, onClose }: ModalProps) {
  const { pubKey, balance, setActiveContractId, fetchGlobalCampaigns } = useStellar();
  const { createCampaign, isSubmitting } = useFactoryContract();

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('1000');
  const [duration, setDuration] = useState('7');
  const [durationUnit, setDurationUnit] = useState('days');

  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [successContractId, setSuccessContractId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSuccessContractId('');
      setError('');
      setStatusMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const numericBalance = parseFloat(balance || '0');
  const hasEnoughBalance = numericBalance > 15;

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnoughBalance) {
      setError('Insufficient balance to pay for contract deployment fees (requires ~15 XLM buffer).');
      return;
    }
    if (!title || parseFloat(goal) <= 0) {
      setError('Please provide a valid title and goal.');
      return;
    }

    setError('');
    try {
      const contractId = await createCampaign(
        pubKey,
        {
          title,
          goalXlm: parseFloat(goal),
          durationMinutes: parseInt(duration, 10) * (durationUnit === 'days' ? 1440 : durationUnit === 'hours' ? 60 : 1),
        },
        setStatusMessage
      );

      setSuccessContractId(contractId);
      await fetchGlobalCampaigns();
    } catch (err: any) {
      setError(err.message || 'Deployment failed.');
    }
  };

  const handleFinish = () => {
    if (successContractId) {
      setActiveContractId(successContractId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="liquid-glass border border-white/10 rounded-2xl shadow-xl backdrop-blur-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-white/5 bg-white/[0.02]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Rocket size={18} className="text-accent" /> Launch Escrow Campaign
          </h2>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto">
          {successContractId ? (
            <div className="flex flex-col items-center justify-center text-center py-6 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4 text-green-400">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Campaign Deployed! 🎉</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your isolated escrow vault is now live on the Stellar Testnet.
              </p>
              
              <div className="w-full bg-black/30 p-4 rounded-xl border border-white/10 mb-6">
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Contract ID (Save This)</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-accent break-all bg-white/5 p-2 rounded text-left">
                    {successContractId}
                  </code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(successContractId)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded transition-colors text-white"
                    title="Copy to clipboard"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <a 
                  href={getExplorerContractUrl(successContractId)}
                  target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
                >
                  View on Stellar Expert <ExternalLink size={12} />
                </a>
                <p className="text-[10px] text-muted-foreground mt-2 opacity-70">
                  Note: Explorer indexing may take up to 30 seconds to appear.
                </p>
              </div>

              <button 
                onClick={handleFinish}
                className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-semibold hover:scale-[1.02] transition-transform"
              >
                Go to my Campaign Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeploy} className="flex flex-col gap-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaign Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Clean Ocean Initiative"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funding Goal</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={goal}
                      onChange={e => setGoal(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full bg-black/20 border border-white/10 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50 text-white"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">XLM</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      required
                      value={duration}
                      onChange={e => setDuration(e.target.value)}
                      disabled={isSubmitting}
                      className="w-1/2 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50 text-white"
                    />
                    <select
                      value={durationUnit}
                      onChange={e => setDurationUnit(e.target.value)}
                      disabled={isSubmitting}
                      className="w-1/2 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent/50 transition-colors appearance-none disabled:opacity-50 text-white"
                    >
                      <option value="minutes" className="bg-[#0c1015]">Minutes</option>
                      <option value="hours" className="bg-[#0c1015]">Hours</option>
                      <option value="days" className="bg-[#0c1015]">Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !hasEnoughBalance || !pubKey}
                className="w-full mt-2 py-3.5 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:hover:bg-accent flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 size={18} className="animate-spin" /> {statusMessage}</>
                ) : (
                  'Deploy Smart Contract (~15 XLM)'
                )}
              </button>
              
              {!hasEnoughBalance && pubKey && !isSubmitting && (
                <p className="text-xs text-center text-red-400 opacity-80">
                  You need more XLM on testnet to deploy a contract. Use the friendbot!
                </p>
              )}

              {isSubmitting && (
                <p className="text-xs text-center text-muted-foreground mt-2 animate-pulse">
                  Deploying through the Factory. Please do not close the window.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
