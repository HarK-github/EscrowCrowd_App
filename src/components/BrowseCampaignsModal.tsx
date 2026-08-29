import React, { useEffect, useState } from 'react';
import { useStellar } from '../hooks/useStellar';
import { Compass, Rocket, Loader2, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchCampaignStateData, CampaignState } from '../hooks/useCrowdfundingContract';

interface BrowseCampaignsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrowseCampaignsModal({ isOpen, onClose }: BrowseCampaignsModalProps) {
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
      
      // Load states in parallel
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
      <div className="bg-[#0c1015] border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
                
                // Format values
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
