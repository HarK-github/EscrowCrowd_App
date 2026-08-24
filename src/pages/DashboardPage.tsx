import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Send, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStellar } from '../context/StellarContext';
import { Navbar } from '../components/Navbar';
import noLoopAnim from '../assets/noloopanim.mp4';
import { CONTRACT_ID, rpcServer, NETWORK_PASSPHRASE, server } from '../context/StellarContext';
import { TransactionBuilder, Contract, nativeToScVal, rpc } from '@stellar/stellar-sdk';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';

export function DashboardPage() {
  const { pubKey, balance, campaign, recentDonations, disconnectWallet, fetchBalance, fetchCampaignState } = useStellar();
  const navigate = useNavigate();

  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txMessage, setTxMessage] = useState('');
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    if (!pubKey) {
      navigate('/');
    }
  }, [pubKey, navigate]);

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    if (parseFloat(amount) <= 0) {
      setTxStatus('error');
      setTxMessage('Donation amount must be greater than 0.');
      return;
    }

    if (balance === "Not Funded" || parseFloat(balance || "0") < parseFloat(amount)) {
      setTxStatus('error');
      setTxMessage('Insufficient XLM balance for this transaction.');
      return;
    }

    setTxStatus('loading');
    setTxMessage('Preparing transaction...');
    setTxHash('');

    try {
      const sourceAccount = await server.loadAccount(pubKey);
      const contract = new Contract(CONTRACT_ID);
      const amountStroops = Math.floor(parseFloat(amount) * 10000000).toString();

      const operation = contract.call('donate',
        nativeToScVal(pubKey, { type: 'address' }),
        nativeToScVal(amountStroops, { type: 'i128' })
      );

      let transaction = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      setTxMessage('Simulating transaction...');
      const simRes = await rpcServer.simulateTransaction(transaction);
      
      if (rpc.Api.isSimulationError(simRes)) {
        throw new Error(typeof simRes.error === 'string' ? simRes.error : JSON.stringify(simRes.error));
      }
      
      if (!rpc.Api.isSimulationSuccess(simRes)) {
        throw new Error("Transaction simulation failed or rejected by contract.");
      }

      transaction = rpc.assembleTransaction(transaction, simRes).build();

      setTxMessage('Please sign in your wallet...');
      const xdr = transaction.toXdr();
      const signResponse = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (!signResponse || !signResponse.signedTxXdr) {
        throw new Error("Failed to sign transaction or transaction rejected.");
      }

      setTxMessage('Submitting to network...');
      const signedTx = TransactionBuilder.fromXdr(signResponse.signedTxXdr, NETWORK_PASSPHRASE);
      const sendRes = await rpcServer.sendTransaction(signedTx);

      if (sendRes.status === 'PENDING') {
        setTxMessage('Waiting for confirmation...');
        let getTxRes = await rpcServer.getTransaction(sendRes.hash);
        while (getTxRes.status === 'NOT_FOUND') {
          await new Promise(resolve => setTimeout(resolve, 2000));
          getTxRes = await rpcServer.getTransaction(sendRes.hash);
        }
        if (getTxRes.status === 'SUCCESS') {
          setTxStatus('success');
          setTxMessage('Donation successful!');
          setTxHash(sendRes.hash);
          fetchBalance(pubKey);
          setAmount('');
          fetchCampaignState();
        } else {
          throw new Error('Transaction failed on network.');
        }
      } else {
        throw new Error('Transaction submission failed.');
      }
    } catch (error: any) {
      setTxStatus('error');
      setTxMessage(error?.message || "Transaction failed");
    }
  };

  if (!pubKey) return null;

  return (
    <div className="font-sans antialiased text-foreground bg-background h-screen flex overflow-hidden relative">

      {/* Background Gradient & Video */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 z-0"
          style={{
            background: "radial-gradient(125% 125% at 50% 10%, #000 40%, rgba(0, 88, 67, 0.2) 100%)",
          }}
        />
        <div className="absolute right-0 w-full md:w-1/2 h-screen">
          <video
            autoPlay muted playsInline
            className="w-full h-full object-cover opacity-15 mix-blend-screen"
            src={noLoopAnim}
          />
        </div>
      </div>

      {/* Floating Glassy Sidebar Layout */}
      <div className="p-6 pr-0 z-40 h-full flex-shrink-0">
        <aside className="w-64 h-full liquid-glass rounded-2xl border border-white/10 flex flex-col backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="text-xl font-bold p-6 border-b border-white/10 flex items-center gap-2 tracking-tight">
            EscrowCrowd
          </div>
          <nav className="flex flex-col gap-2 p-4">
            <a href="#" className="px-4 py-2 rounded-lg bg-white/10 text-white font-medium">Overview Dashboard</a>
            <a href="#" className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors">Active Campaigns</a>
            <a href="#" className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors">My Escrows</a>
            <a href="#" className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors">Transaction History</a>
          </nav>
        </aside>
      </div>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col z-40 overflow-y-auto">

        {/* Top Header */}
        <header className="h-24 flex items-center justify-end px-8 sticky top-0 z-50 pt-6">
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm px-4 py-2 bg-black/60 border border-white/10 rounded-full backdrop-blur-md">
              {pubKey.slice(0, 4)}...{pubKey.slice(-4)}
            </span>
            <button
              onClick={() => {
                disconnectWallet();
                navigate('/');
              }}
              className="text-sm font-medium bg-white/10 text-white backdrop-blur-md px-5 py-2 rounded-full hover:bg-white/20 hover:scale-[1.02] transition-all"
            >
              Disconnect
            </button>
          </div>
        </header>

        {/* Dashboard Content Grid */}
        <main className="p-8 pt-4 flex flex-col gap-8 max-w-7xl mx-auto w-full">

          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="liquid-glass rounded-2xl p-6 shadow-xl border border-white/10 backdrop-blur-xl">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Escrow Balance</div>
              <div className="text-2xl font-semibold font-serif italic">{balance !== null ? `${balance} XLM` : '...'}</div>
            </div>
            <div className="liquid-glass rounded-2xl p-6 shadow-xl border border-white/10 backdrop-blur-xl">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Target Goal</div>
              <div className="text-2xl font-semibold font-serif italic">{campaign ? `${campaign.goal} XLM` : '...'}</div>
            </div>
            <div className="liquid-glass rounded-2xl p-6 shadow-xl border border-white/10 backdrop-blur-xl">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Current Status</div>
              <div className="text-lg font-semibold flex items-center gap-2 capitalize">
                {campaign ? (
                  <>
                    <span className={`w-2 h-2 rounded-full ${campaign.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                    {campaign.status}
                  </>
                ) : '...'}
              </div>
            </div>
            <div className="liquid-glass rounded-2xl p-6 shadow-xl border border-white/10 backdrop-blur-xl">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Deadline</div>
              <div className="text-lg font-semibold leading-tight">
                {campaign ? (
                  <>
                    {new Date(campaign.deadline * 1000).toLocaleDateString()}<br />
                    <span className="text-sm text-muted-foreground font-normal">
                      {new Date(campaign.deadline * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                ) : '...'}
              </div>
            </div>
          </div>

          {/* Main Layout: 2/3 Left, 1/3 Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Column */}
            <div className="lg:col-span-2 flex flex-col gap-8">

              {/* Crowdfund Status */}
              <div className="liquid-glass rounded-2xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl flex flex-col">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                  <Wallet size={20} /> Crowdfund Status
                </h2>

                <div className="mb-6">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">My Address</div>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 font-mono text-sm text-muted-foreground break-all">
                    {pubKey}
                  </div>
                </div>

                {campaign && (
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Progress</span>
                      <span className="text-sm opacity-80">{campaign.totalRaised} / {campaign.goal} XLM</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-white h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min((campaign.totalRaised / campaign.goal) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Activity Console */}
              <div className="liquid-glass rounded-2xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl flex-1 flex flex-col">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Live Activity
                </h2>
                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 font-mono text-sm">
                  {recentDonations.length === 0 ? (
                    <p className="text-muted-foreground">&gt; Waiting for activity...</p>
                  ) : (
                    recentDonations.map((event) => {
                      const timeAgo = Math.floor((new Date().getTime() - new Date(event.timestamp).getTime()) / 60000);
                      return (
                        <div key={event.id} className="bg-white/5 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>&gt;</span>
                            <span className="text-white opacity-80">{event.donor.slice(0, 6)}...{event.donor.slice(-4)}</span>
                            <span>donated</span>
                            <strong className="text-white">{event.amount} XLM</strong>
                          </div>
                          <span className="text-xs text-muted-foreground opacity-60">
                            {timeAgo < 1 ? 'Just now' : `${timeAgo} min ago`}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-8">

              {/* Support Campaign Action Card */}
              <div className="liquid-glass rounded-2xl p-8 shadow-2xl border border-white/20 backdrop-blur-xl">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                  <Send size={20} /> Support Campaign
                </h2>
                <form onSubmit={handleSendTransaction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Donation Amount (XLM)</label>
                    <div className="flex bg-black/60 border border-white/10 rounded-lg overflow-hidden p-1">
                      <input
                        type="number" step="1" min="1" placeholder="10" value={amount} onChange={(e) => {
                          if (Number(e.target.value) >= 0) {
                            setAmount(e.target.value);
                          }
                        }} required
                        className="w-full bg-transparent px-3 py-2 text-white focus:outline-none font-mono text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={txStatus === 'loading' || !amount || balance === "Not Funded"}
                    className="w-full bg-foreground text-background py-3.5 rounded-full text-base font-medium hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-50 transition-transform flex justify-center items-center gap-2"
                  >
                    {txStatus === 'loading' ? (
                      <><span className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full"></span> Processing...</>
                    ) : 'Donate XLM'}
                  </button>
                </form>

                {txStatus && (
                  <div className={`mt-4 p-4 rounded-lg border text-sm flex flex-col gap-2 ${txStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                    <div className="flex items-center gap-2">
                      {txStatus === 'loading' ? (
                        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                      ) : txStatus === 'error' ? (
                        <span className="text-lg">❌</span>
                      ) : (
                        <span className="text-lg">✅</span>
                      )}
                      <strong className="block">{txMessage}</strong>
                    </div>
                    {txHash && (
                      <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 opacity-70 hover:opacity-100 underline">
                        View on Stellar Expert <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Technical Details */}
              <div className="liquid-glass rounded-2xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                  <span className="opacity-80">🔗</span> Contract Details
                </h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract ID</span>
                    <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer" className="font-mono text-sm opacity-90 hover:text-white transition-colors flex items-center gap-1">
                      {CONTRACT_ID.slice(0, 8)}...{CONTRACT_ID.slice(-4)} <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Creator</span>
                    <a href={`https://stellar.expert/explorer/testnet/account/${campaign?.creator || ''}`} target="_blank" rel="noreferrer" className="font-mono text-sm opacity-90 hover:text-white transition-colors flex items-center gap-1">
                      {campaign?.creator ? `${campaign.creator.slice(0, 8)}...${campaign.creator.slice(-4)}` : '...'} <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
