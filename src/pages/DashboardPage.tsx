import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Send, ExternalLink, Activity, Trophy, Clock, Target, CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStellar } from '../hooks/useStellar';
import { useCrowdfundingContract, TxStatus } from '../hooks/useCrowdfundingContract';
import noLoopAnim from '../assets/noloopanim.mp4';
import { rpcServer } from '../config';
import { useToast } from '../components/Toast';
import { ContractInfoPanel } from '../components/ContractInfoPanel';
import { Navbar } from '../components/Navbar';

export function DashboardPage() {
  const { pubKey, balance, campaign, recentDonations, disconnectWallet, fetchBalance, fetchCampaignState, addDonationEvent, appError, activeContractId, customCampaigns } = useStellar();
  const { toast } = useToast();
  const { donate, withdraw, isSubmitting } = useCrowdfundingContract(activeContractId);
  const navigate = useNavigate();

  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [amount, setAmount] = useState('10');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txMessage, setTxMessage] = useState('');
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    if (!pubKey) {
      navigate('/');
    }
  }, [pubKey, navigate]);

  const myTransactions = useMemo(() => {
    return recentDonations.filter(d => d.donor === pubKey);
  }, [recentDonations, pubKey]);

  const displayedDonations = recentDonations;

  const hasBadge = useMemo(() => {
    return recentDonations.some(d => d.donor === pubKey && parseFloat(d.amount.toString()) >= 100);
  }, [recentDonations, pubKey]);

  // Derived campaign stats
  const progressPercent = campaign ? Math.min((campaign.totalRaised / campaign.goal) * 100, 100) : 0;
  
  const timeRemainingText = useMemo(() => {
    if (!campaign) return '48 hours left';
    // oxlint-disable-next-line react/purity
    const now = Math.floor(Date.now() / 1000);
    const diff = campaign.deadline - now;
    if (diff <= 0) return 'Campaign ended';
    if (diff < 3600) return `${Math.max(1, Math.ceil(diff / 60))} mins left`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours left`;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days < 7) return `${days}d ${hours}h left`;
    if (days > 100) return '48 hours left';
    return `${days} days left`;
  }, [campaign]);

  // Inline Validation
  const inlineError = useMemo(() => {
    if (!amount) return null;
    const parsedAmount = parseFloat(amount);
    if (parsedAmount <= 0) return "Amount must be greater than 0.";
    if (balance === "Not Funded" || parseFloat(balance || "0") < parsedAmount) {
      return "Insufficient XLM balance for this transaction.";
    }
    return null;
  }, [amount, balance]);

  const isPending = isSubmitting || txStatus === 'preparing' || txStatus === 'signing' || txStatus === 'confirming';

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isPending) {
        e.preventDefault();
        e.returnValue = "Transaction is pending. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isPending]);

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || inlineError || isPending) return;

    setTxStatus('preparing');
    setTxMessage('Preparing transaction...');
    setTxHash('');

    try {
      const hash = await donate(pubKey, amount, (msg) => {
        setTxMessage(msg);
        if (msg.includes('sign')) {
          setTxStatus('signing');
        } else if (msg.includes('Submitting')) {
          setTxStatus('confirming');
        }
      });

      // Simulate the sendRes object structure to keep the existing confirmation loop intact
      const sendRes = { status: 'PENDING', hash };

      if (sendRes.status === 'PENDING') {
        setTxStatus('confirming');
        setTxMessage('Waiting for confirmation on Stellar...');
        let getTxRes = await rpcServer.getTransaction(sendRes.hash);
        while (getTxRes.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 2000));
          getTxRes = await rpcServer.getTransaction(sendRes.hash);
        }
        if (getTxRes.status === 'SUCCESS') {
          const donatedAmount = parseFloat(amount);
          // Immediately populate both Activity Feed and My Transactions
          addDonationEvent({
            id: sendRes.hash,
            donor: pubKey,
            amount: donatedAmount,
            timestamp: new Date().toISOString(),
          });
          setTxStatus('success');
          setTxMessage('Donation successful!');
          setTxHash(sendRes.hash);
          fetchBalance(pubKey);
          setAmount('');
          toast("Donation successful!", "success");
          fetchCampaignState();
        } else {
          throw new Error('Transaction failed on network.');
        }
      } else {
        throw new Error('Transaction submission failed.');
      }
    } catch (err: any) {
      console.error(err);
      setTxStatus('error');
      setTxMessage(err?.message || 'Transaction failed');
      toast(err?.message || "Transaction failed", "error");
    }
  };

  const handleWithdraw = async () => {
    if (isPending || isWithdrawing) return;
    setIsWithdrawing(true);
    setTxStatus('preparing');
    setTxMessage('Preparing withdrawal...');
    
    try {
      const hash = await withdraw(pubKey, (msg) => {
        setTxMessage(msg);
        if (msg.includes('sign')) setTxStatus('signing');
        else if (msg.includes('Submitting')) setTxStatus('confirming');
      });
      
      const sendRes = { status: 'PENDING', hash };
      if (sendRes.status === 'PENDING') {
        setTxStatus('confirming');
        setTxMessage('Waiting for confirmation on Stellar...');
        let getTxRes = await rpcServer.getTransaction(sendRes.hash);
        while (getTxRes.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 2000));
          getTxRes = await rpcServer.getTransaction(sendRes.hash);
        }
        if (getTxRes.status === 'SUCCESS') {
          setTxStatus('success');
          setTxMessage('Withdrawal successful!');
          setTxHash(sendRes.hash);
          fetchBalance(pubKey);
          toast("Withdrawal successful!", "success");
          fetchCampaignState();
        } else {
          throw new Error('Transaction failed on network.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setTxStatus('error');
      setTxMessage(err?.message || 'Withdrawal failed');
      toast(err?.message || "Withdrawal failed", "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="font-sans antialiased text-foreground bg-background min-h-screen flex flex-col relative overflow-hidden">
      {isPending && (
        <div className="absolute top-0 left-0 w-full h-1.5 z-[9999] bg-accent/20 overflow-hidden">
          <div className="w-full h-full bg-accent animate-loading-bar rounded-r-full"></div>
        </div>
      )}

      
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(125% 125% at 50% 10%, #000 40%, rgba(0,88,67,0.2) 100%)' }} />
        <div className="absolute right-0 w-full md:w-1/2 h-screen">
          <video autoPlay muted playsInline className="w-full h-full object-cover opacity-15 mix-blend-screen" src={noLoopAnim} />
        </div>
      </div>

      <div className="z-40 relative flex-1 flex flex-col w-full">
        
        {/* Navbar replaces the custom header for consistency */}
        <div className="mb-6">
          <Navbar />
        </div>
        {appError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center shadow-xl text-sm max-w-5xl mx-auto w-full">
            <span>{appError}</span>
          </div>
        )}


        <div className="flex flex-col md:flex-row gap-6 md:gap-8 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-8">
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-6 md:gap-8">
            
            {/* Top Row: Progress and Badges (Stacked on Mobile, Row on Desktop) */}
            <div className="flex flex-col md:flex-row gap-6">
              
              {/* Campaign Progress Card */}
              <div className="flex-[2] p-6 border border-white/5 rounded-xl bg-transparent flex flex-col justify-between">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Target size={16} /> Campaign Progress
                  </h2>
                  {campaign ? (
                    <>
                      <div className="text-4xl md:text-5xl font-semibold font-serif italic mb-2 tracking-tight">
                        {progressPercent.toFixed(0)}%
                      </div>
                      <div className="text-muted-foreground font-mono text-sm mb-6">
                        <strong className="text-white">{campaign.totalRaised}</strong> / {campaign.goal} XLM
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden mb-4 relative">
                        <div
                          className="bg-accent h-3 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock size={14} /> Deadline: {timeRemainingText}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold capitalize border border-green-500/30 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                          {campaign.status}
                        </span>
                      </div>

                      {/* Escrow Vault Explanation */}
                      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-3">
                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start">
                          <span className="flex items-center gap-1.5 text-neutral-300">
                            <ShieldCheck size={14} className="text-accent" /> All-or-Nothing Escrow Vault
                          </span>
                          <span className="text-[11px] text-neutral-400 hidden sm:inline">
                            Funds locked on-chain until goal is reached
                          </span>
                        </div>
                        
                        {/* Withdraw Button for Creator */}
                        {pubKey === campaign.creator && campaign.status === 'completed' && (
                          <button
                            onClick={handleWithdraw}
                            disabled={isWithdrawing || txStatus === 'success'}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 bg-accent text-accent-foreground hover:scale-105 hover:shadow-[0_0_15px_rgba(0,184,148,0.3)] disabled:opacity-50 disabled:hover:scale-100"
                          >
                            {isWithdrawing ? (
                              <><Loader2 size={14} className="animate-spin" /> Withdrawing...</>
                            ) : (
                              'Withdraw Funds'
                            )}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="animate-pulse flex flex-col gap-4">
                      <div className="h-10 w-24 bg-white/10 rounded-lg"></div>
                      <div className="h-4 w-40 bg-white/10 rounded-lg"></div>
                      <div className="h-3 w-full bg-white/10 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Badges Card */}
              <div className="flex-1 p-6 border border-white/5 rounded-xl bg-transparent flex flex-col">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Trophy size={16} /> Your Badges
                </h2>
                <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                  {hasBadge ? (
                    <div className="flex flex-col items-center gap-3 animate-in zoom-in duration-500">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400/20 to-yellow-600/40 border border-yellow-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                        <span className="text-3xl">🏅</span>
                      </div>
                      <div>
                        <div className="font-semibold text-yellow-500">Top Supporter</div>
                        <div className="text-xs text-muted-foreground mt-1">Donated &gt; 100 XLM</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-50 grayscale">
                      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <Trophy size={20} className="text-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">None yet</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Donate Form (Prioritized on Mobile) */}
            <div className="p-5 sm:p-6 border border-white/5 rounded-xl bg-transparent order-first md:order-none relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
              <h2 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center gap-2">
                <Send size={18} className="text-accent" /> Make a Donation
              </h2>
              
              <form onSubmit={handleSendTransaction} className="flex flex-col gap-4">
                <div className="relative flex items-center border border-white/5 bg-transparent rounded-xl overflow-hidden focus-within:border-accent/50 transition-colors">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="10"
                    value={amount}
                    onChange={(e) => {
                      if (Number(e.target.value) >= 0 || e.target.value === '') {
                        setAmount(e.target.value);
                        setTxStatus('idle'); // reset state on new input
                      }
                    }}
                    required
                    disabled={txStatus === 'loading'}
                    className="w-full bg-transparent px-4 py-3.5 sm:py-4 text-lg sm:text-xl text-white font-mono placeholder:text-white/20 focus:outline-none min-h-[48px]"
                  />
                  <div className="pr-4 font-mono text-muted-foreground font-semibold text-sm sm:text-base">XLM</div>
                </div>

                {/* Quick-select Amount Presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">Quick Amount:</span>
                  {[5, 10, 25, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setAmount(preset.toString());
                        setTxStatus('idle');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors border ${
                        amount === preset.toString()
                          ? 'bg-accent text-accent-foreground border-accent font-semibold'
                          : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
                      }`}
                    >
                      {preset} XLM{preset === 100 ? ' 🏅' : ''}
                    </button>
                  ))}
                </div>

                {/* Inline Validation Error */}
                {inlineError && amount !== '' && txStatus === 'idle' && (
                  <div className="text-red-400 text-xs sm:text-sm flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                    <XCircle size={14} className="shrink-0" /> <span>{inlineError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending || !!inlineError || !amount}
                  className={`w-full py-3.5 sm:py-4 min-h-[48px] rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 flex justify-center items-center gap-2 active:scale-[0.99]
                    ${txStatus === 'success' ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 
                      txStatus === 'error' ? 'bg-red-500 text-white' : 
                      'bg-accent text-accent-foreground hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(0,184,148,0.2)] disabled:hover:scale-100 disabled:opacity-50 disabled:shadow-none'
                    }`}
                >
                  {isPending ? (
                    <><Loader2 size={18} className="animate-spin shrink-0" /> <span className="truncate">{txMessage}</span></>
                  ) : txStatus === 'success' ? (
                    <><CheckCircle2 size={18} className="shrink-0" /> Donation Successful</>
                  ) : txStatus === 'error' ? (
                    <><XCircle size={18} className="shrink-0" /> Retry Donation</>
                  ) : (
                    'Donate Now'
                  )}
                </button>

                {txStatus === 'error' && (
                  <div className="text-red-400 text-xs sm:text-sm mt-1 text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20 break-words">
                    {txMessage}
                  </div>
                )}
                
                {txStatus === 'success' && txHash && (
                  <div className="text-center mt-1">
                    <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-white underline inline-flex items-center gap-1">
                      View transaction on Stellar Expert <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </form>
            </div>

            {/* Live Activity Feed */}
            <div className="liquid-glass rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-xl flex flex-col h-[300px] sm:h-[350px]">
              <div className="flex justify-between items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} /> Activity Feed
                  </h2>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Live stream of all public contributions across Stellar
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-accent uppercase tracking-widest bg-accent/10 px-2 py-0.5 sm:py-1 rounded-md border border-accent/20 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                  Live
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 sm:space-y-3 relative">
                {!campaign ? (
                  <div className="absolute inset-0 flex flex-col gap-3">
                     {[1,2,3].map(i => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse w-full"></div>)}
                  </div>
                ) : displayedDonations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60 text-sm">
                    <Activity size={32} className="mb-2 opacity-50" />
                    <p>No activity yet.</p>
                  </div>
                ) : (
                  displayedDonations.map((event, idx) => {
                    const timeAgo = Math.floor((new Date().getTime() - new Date(event.timestamp).getTime()) / 60000);
                    const isTopSupporter = parseFloat(event.amount.toString()) >= 100;
                    
                    return (
                      <div 
                        key={event.id} 
                        className="p-2.5 sm:p-3.5 border-y border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors animate-in slide-in-from-top-2 fade-in duration-300 text-xs sm:text-sm"
                        style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center font-mono text-[11px] sm:text-xs text-muted-foreground shrink-0 border border-white/10">
                            {event.donor.slice(0,2)}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
                            <span className="font-mono text-xs sm:text-sm text-white/90 truncate">{event.donor.slice(0, 5)}...{event.donor.slice(-4)}</span>
                            <span className="text-muted-foreground text-xs hidden sm:inline">donated</span>
                            <div className="flex items-center gap-1.5">
                              <strong className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded text-xs sm:text-sm">{event.amount} XLM</strong>
                              {isTopSupporter && <span title="Top Supporter Badge Earned">🏅</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] sm:text-xs text-muted-foreground font-medium shrink-0 ml-2">
                          {timeAgo < 1 ? 'Just now' : `${timeAgo}m ago`}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Right Sidebar: My Transactions */}
          <div className="w-full md:w-80 flex flex-col gap-6 h-[350px] md:h-auto md:min-h-full">
            <div className="liquid-glass rounded-2xl p-6 shadow-xl backdrop-blur-xl flex flex-col h-[350px] md:h-[calc(100vh-250px)]">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Wallet size={16} /> My Transactions
                  </h2>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Contributions sent from your connected wallet
                  </p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 relative">
                {!campaign ? (
                  <div className="absolute inset-0 flex flex-col gap-3">
                     {[1,2,3].map(i => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse w-full"></div>)}
                  </div>
                ) : myTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                    <p>No transactions yet.</p>
                  </div>
                ) : (
                  myTransactions.map((event, idx) => {
                    const timeAgo = Math.floor((new Date().getTime() - new Date(event.timestamp).getTime()) / 60000);
                    return (
                      <div 
                        key={event.id} 
                        className="bg-black/30 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1 hover:bg-white/5 transition-colors animate-in slide-in-from-top-2 fade-in duration-300"
                        style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded text-sm">{event.amount} XLM</span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {timeAgo < 1 ? 'Just now' : `${timeAgo}m ago`}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">Tx ID: {event.id.slice(0, 12)}...</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contract Transparency Panel */}
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-16 pb-8">
          <ContractInfoPanel defaultExpanded={false} />
        </div>
      </div>
    </div>
  );
}
