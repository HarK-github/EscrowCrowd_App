import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown, Wallet, LogOut, Send, ExternalLink } from 'lucide-react';
import {
  StellarWalletsKit,
  Networks,
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { Horizon, TransactionBuilder, Networks as StellarNetworks, Asset, Operation, Contract, rpc, nativeToScVal, scValToNative, Account, Keypair } from '@stellar/stellar-sdk';

const CONTRACT_ID = 'CAKBK6LDUAYFCIGDMGWGYEXDSRSVCLDJDUXHOSCS2BQYBNZLS3NPFRQS';
const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org:443');

StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: 'freighter',
  modules: [new FreighterModule(), new AlbedoModule(), new xBullModule()],
});
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarNetworks.TESTNET;
const server = new Horizon.Server(HORIZON_URL);

// Placeholder Assets
const LOGO_URL = "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?q=80&w=100&auto=format&fit=crop";
const DASHBOARD_IMG = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2000&auto=format&fit=crop";
const QUOTE_ICON = "https://cdn-icons-png.flaticon.com/512/2997/2997300.png";
const AVATAR_IMG = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop";

function App() {
  const sectionRef = useRef<HTMLElement>(null);
  const testimonialContainerRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Freighter State
  const [pubKey, setPubKey] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txMessage, setTxMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [appError, setAppError] = useState('');
  const [campaign, setCampaign] = useState<any>(null);

  // Auto-scroll when connected
  useEffect(() => {
    if (pubKey && dashboardRef.current) {
      dashboardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [pubKey]);

  // Hero Parallax Scroll Effects
  const { scrollYProgress: heroScroll } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });

  const heroTextY = useTransform(heroScroll, [0, 1], [0, -200]);
  const heroTextOpacity = useTransform(heroScroll, [0, 1], [1, 0]);
  const dashboardY = useTransform(heroScroll, [0, 1], [0, -250]);

  // Testimonial Scroll-Driven Reveal
  const { scrollYProgress: testimonialScroll } = useScroll({
    target: testimonialContainerRef,
    offset: ["start end", "end center"]
  });

  const testimonialText = "EscrowCrowd brings absolute trust to crowdfunding. If a project fails to meet its goal by the deadline, your funds are completely safe. This smart contract driven escrow completely changes the game for backers.";
  const words = testimonialText.split(" ");

  // Fetch Campaign State
  const fetchCampaignState = async () => {
    try {
      const dummyAccount = new Account(Keypair.random().publicKey(), '0');
      const contract = new Contract(CONTRACT_ID);
      const tx = new TransactionBuilder(dummyAccount, { fee: '100', networkPassphrase: StellarNetworks.TESTNET })
        .addOperation(contract.call('get_campaign_state'))
        .setTimeout(30)
        .build();
        
      const response = await rpcServer.simulateTransaction(tx);
      if (rpc.Api.isSimulationSuccess(response)) {
        const resultVal = response.result.retval;
        const state = scValToNative(resultVal);
        
        setCampaign({
          creator: state.creator,
          deadline: Number(state.deadline),
          goal: Number(state.goal) / 10000000,
          status: state.status,
          token: state.token,
          totalRaised: Number(state.total_raised) / 10000000,
        });
      }
    } catch (e) {
      console.error("Failed to fetch campaign state:", e);
    }
  };

  useEffect(() => { 
    fetchCampaignState();
  }, []);

  const fetchBalance = async (publicKey: string) => {
    try {
      const account = await server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      setBalance(nativeBalance ? nativeBalance.balance : "0");
    } catch (e) {
      setBalance("Not Funded");
    }
  };

  const fetchNetworkFee = async (): Promise<string> => {
    try {
      const feeStats = await server.feeStats();
      // Add a 10% buffer to the base fee to ensure transaction success during high traffic
      const baseFee = parseInt(feeStats.last_ledger_base_fee, 10);
      return Math.ceil(baseFee * 1.1).toString();
    } catch (e) {
      console.error("Failed to fetch dynamic fee, falling back to 100 stroops", e);
      return '100';
    }
  };

  const connectWallet = async () => {
    setAppError('');
    try {
      const { address } = await StellarWalletsKit.authModal();
      if (address) {
        setPubKey(address);
        fetchBalance(address);
      }
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.toLowerCase() || '';
      if (msg.includes('not installed') || msg.includes('not found')) {
        setAppError("Wallet not found. Please install the required extension.");
      } else {
        setAppError("Connection rejected or failed.");
      }
    }
  };

  const disconnectWallet = () => {
    setPubKey('');
    setBalance(null);
  };

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    
    // Check sufficient balance
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
      
      // Assemble the transaction using the simulation result for correct fees/auth
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
            fetchCampaignState(); // Update UI with new state
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

  return (
    <div className="font-sans antialiased text-foreground bg-background">
      {/* Section 1: Hero */}
      <section ref={sectionRef} className="relative min-h-screen overflow-hidden flex flex-col">

        {/* Navbar */}
        <nav className="px-8 md:px-28 py-4 flex items-center justify-between z-50">
          <div className="flex items-center gap-12 md:gap-20">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight">EscrowCrowd</span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {!pubKey && (
                <>
                  <a href="#" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">How it works</a>
                  <a href="#" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">Campaigns</a>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {pubKey && (
              <span className="text-sm font-medium hidden md:block">
                Welcome, {pubKey.slice(0, 4)}...{pubKey.slice(-4)}
              </span>
            )}
            {pubKey ? (
              <button onClick={disconnectWallet} className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                <LogOut size={16} /> Disconnect
              </button>
            ) : (
              <button onClick={connectWallet} className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                <Wallet size={16} /> Connect Wallet
              </button>
            )}
          </div>
        </nav>

        {/* Landing Page Content */}
        {!pubKey && (
          <motion.div
            style={{ y: heroTextY, opacity: heroTextOpacity }}
            className="relative z-40 mt-16 md:mt-20 px-4 flex flex-col items-center text-center"
          >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0 }}
            className="liquid-glass px-3 py-2 rounded-lg mb-6 flex items-center gap-2"
          >
            <span className="bg-white text-black rounded-md text-sm font-medium px-2 py-0.5">Live</span>
            <span className="text-sm font-medium text-muted-foreground pr-1">Live on Stellar Testnet</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl tracking-[-2px] font-medium leading-tight md:leading-[1.15] mb-3 max-w-4xl"
          >
            Decentralized <br />
            Crowdfunding <span className="font-serif italic font-normal">Escrow.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg font-normal leading-6 opacity-90 mb-8 max-w-2xl text-[color:var(--color-hero-subtitle)]"
          >
            Fund projects with confidence. Funds are locked in smart contracts<br />and only released when the goal is met.
          </motion.p>

          <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col items-center gap-4 z-50"
            >
              <button
                onClick={connectWallet}
                className="bg-foreground text-background rounded-full px-8 py-3.5 text-base font-medium flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <Wallet size={18} /> Connect Wallet
              </button>
              {appError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm max-w-md text-center">
                  {appError}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Dashboard Content (Logged In) */}
        {pubKey ? (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative z-40 max-w-6xl mx-auto w-full px-6 pb-24 mt-12"
          >
            <div className="grid md:grid-cols-2 gap-8">
              {/* Campaign / Wallet Panel */}
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
                              className="bg-white h-3 rounded-full" 
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

              {/* Donate Panel */}
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
          </motion.div>
        ) : (
          <motion.div
            ref={dashboardRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            style={{ y: dashboardY }}
            className="relative w-screen min-h-[500px] mt-12 flex items-center justify-center z-30 pointer-events-none"
            style={{ marginLeft: 'calc(-50vw + 50%)' }}
          >
            <video
              autoPlay loop muted playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
            />
            <img
              src={DASHBOARD_IMG}
              alt="Dashboard UI"
              className="absolute max-w-5xl w-[90%] rounded-2xl mix-blend-luminosity shadow-2xl border border-[color:var(--color-border)] pointer-events-none"
            />
            {/* Bottom Gradient */}
            <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-background to-transparent z-30 pointer-events-none"></div>
          </motion.div>
        )}
      </section>

      {/* Section 2: Testimonial */}
      <section className="min-h-screen py-24 md:py-32 px-8 md:px-28 flex items-center justify-center bg-background relative z-10">
        <div ref={testimonialContainerRef} className="max-w-3xl mx-auto flex flex-col items-start gap-10">

          <img src={QUOTE_ICON} alt="Quote" className="w-14 h-10 object-contain opacity-80 invert" />

          <div className="text-3xl md:text-5xl font-medium leading-[1.3] flex flex-wrap text-center md:text-left justify-center md:justify-start">
            {words.map((word, i) => {
              const start = i / words.length;
              const end = (i + 1) / words.length;
              const opacity = useTransform(testimonialScroll, [start, end], [0.3, 1]);
              const color = useTransform(testimonialScroll, [start, end], ["hsl(0 0% 50%)", "hsl(0 0% 100%)"]);

              return (
                <motion.span key={i} style={{ opacity, color }} className="mr-[0.3em] transition-colors duration-100">
                  {word}
                </motion.span>
              );
            })}
            <span className="text-muted-foreground ml-2">"</span>
          </div>


        </div>
      </section>
    </div>
  );
}

export default App;
