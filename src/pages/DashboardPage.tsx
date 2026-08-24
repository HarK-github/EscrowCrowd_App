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
  const { pubKey, balance, campaign, recentDonations, fetchBalance, fetchCampaignState } = useStellar();
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
      if (!rpc.Api.isSimulationSuccess(simRes)) {
        throw new Error("Transaction simulation failed or rejected by contract.");
      }

      transaction = rpc.assembleTransaction(transaction, NETWORK_PASSPHRASE, simRes).built;

      setTxMessage('Please sign in your wallet...');
      const xdr = transaction.toXDR();
      const signResponse = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (!signResponse || !signResponse.signedTxXdr) {
        throw new Error("Failed to sign transaction or transaction rejected.");
      }

      setTxMessage('Submitting to network...');
      const signedTx = TransactionBuilder.fromXDR(signResponse.signedTxXdr, NETWORK_PASSPHRASE);
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
    <div className="font-sans antialiased text-foreground bg-background min-h-screen flex flex-col">
      <Navbar />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-40 max-w-6xl mx-auto w-full px-6 pb-24 mt-12 flex-1"
      >
        <div className="grid md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-8">
            <div className="liquid-glass rounded-2xl p-8 shadow-2xl border border-white/10 text-left backdrop-blur-xl flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Wallet /> Crowdfund Status
                </h2>
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">My Address</p>
                    <div className="font-mono text-xs break-all opacity-80">
                      {pubKey}
                    </div>
                  </div>
                  {campaign && (
                    <>
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Progress</p>
                          <span className="text-sm opacity-80">{campaign.totalRaised} / {campaign.goal} XLM</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-3">
                          <div
                            className="bg-white h-3 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${Math.min((campaign.totalRaised / campaign.goal) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Status</p>
                          <p className="font-semibold capitalize">{campaign.status}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase">Balance</p>
                          <p className="font-semibold font-serif italic">{balance !== null ? `${balance} XLM` : '...'}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Live Activity Feed */}
            <div className="liquid-glass rounded-2xl p-6 shadow-2xl border border-white/10 text-left backdrop-blur-xl flex flex-col">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Live Activity
              </h2>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {recentDonations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Waiting for activity...</p>
                ) : (
                  recentDonations.map((event) => {
                    const timeAgo = Math.floor((new Date().getTime() - new Date(event.timestamp).getTime()) / 60000);
                    return (
                      <div key={event.id} className="text-sm bg-white/5 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono opacity-70">{event.donor.slice(0, 4)}...{event.donor.slice(-4)}</span>
                          <span>donated</span>
                          <strong className="text-white">{event.amount} XLM</strong>
                        </div>
                        <span className="text-xs text-muted-foreground opacity-70">
                          {timeAgo < 1 ? 'Just now' : `${timeAgo} min ago`}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="liquid-glass rounded-2xl p-8 shadow-2xl border border-white/10 text-left backdrop-blur-xl">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Send /> Support Campaign
            </h2>
            <form onSubmit={handleSendTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Donation Amount (XLM)</label>
                <input
                  type="number" step="1" placeholder="10" value={amount} onChange={(e) => setAmount(e.target.value)} required
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-white/50 font-mono text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={txStatus === 'loading' || !amount || balance === "Not Funded"}
                className="w-full mt-2 bg-white text-black py-3 rounded-lg font-semibold hover:bg-white/90 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
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
        </div>

        <div className="fixed top-0 right-0 w-full md:w-1/2 h-screen pointer-events-none z-0 ">
          <video
            autoPlay muted playsInline
            className="w-full h-full object-cover opacity-10 blur-md  mix-blend-screen"
            src={noLoopAnim}
          />
        </div>
      </motion.div>
    </div>
  );
}
