import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown, Wallet, LogOut, Send, ExternalLink } from 'lucide-react';
import {
  isConnected,
  isAllowed,
  setAllowed,
  getAddress,
  signTransaction
} from '@stellar/freighter-api';
import { Horizon, TransactionBuilder, Networks, Asset, Operation } from '@stellar/stellar-sdk';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
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
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txMessage, setTxMessage] = useState('');
  const [txHash, setTxHash] = useState('');

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

  const testimonialText = "Stellar revolutionized how we handle decentralized payments using lightning-fast finality. We are now driving global transactions quicker than we ever imagined! Stellar revolutionized how we handle financial insights.";
  const words = testimonialText.split(" ");

  // Freighter Logic
  useEffect(() => { checkConnection(); }, []);

  const checkConnection = async () => {
    try {
      const allowed = await isAllowed();
      if (allowed) {
        const { address, error } = await getAddress();
        if (address && !error) {
          setPubKey(address);
          fetchBalance(address);
        } else if (error) {
          console.error("Freighter address error:", error);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBalance = async (publicKey: string) => {
    try {
      const account = await server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      setBalance(nativeBalance ? nativeBalance.balance : "0");
    } catch (e) {
      setBalance("Not Funded");
    }
  };

  const connectWallet = async () => {
    try {
      const connected = await isConnected();
      if (!connected) {
        alert("Freighter is not installed! Please install the Freighter browser extension.");
        return;
      }
      await setAllowed();
      await checkConnection();
    } catch (e) {
      console.error(e);
      alert("Failed to connect to Freighter");
    }
  };

  const disconnectWallet = () => {
    setPubKey('');
    setBalance(null);
  };

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toAddress || !amount) return;
    setTxStatus('loading');
    setTxMessage('Preparing transaction...');
    setTxHash('');

    try {
      const sourceAccount = await server.loadAccount(pubKey);
      
      // Check if destination exists
      let operation;
      try {
        await server.loadAccount(toAddress);
        // Destination exists, use normal payment
        operation = Operation.payment({
          destination: toAddress,
          asset: Asset.native(),
          amount: amount.toString()
        });
      } catch (err: any) {
        // If 404, destination doesn't exist. We must create the account instead.
        if (err.response && err.response.status === 404) {
          operation = Operation.createAccount({
            destination: toAddress,
            startingBalance: amount.toString()
          });
        } else {
          throw err;
        }
      }

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      setTxMessage('Please sign in Freighter...');
      const xdr = transaction.toXDR();
      const signResponse = await signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (signResponse.error) {
        throw new Error(signResponse.error);
      }

      setTxMessage('Submitting to network...');
      const signedTx = TransactionBuilder.fromXDR(signResponse.signedTxXdr, NETWORK_PASSPHRASE);
      const response = await server.submitTransaction(signedTx);

      setTxStatus('success');
      setTxMessage('Transaction successful!');
      setTxHash(response.hash);
      fetchBalance(pubKey);
      setToAddress('');
      setAmount('');
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
              <span className="text-xl font-bold tracking-tight">Stellar Web3</span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <a href="#" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">Home</a>
              <a href="#" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors flex items-center gap-1">
                Services <ChevronDown className="w-4 h-4" />
              </a>
              <a href="#" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">Reviews</a>
              <a href="#" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">Contact us</a>
            </div>
          </div>

          <div>
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

        {/* Hero Content */}
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
            <span className="text-sm font-medium text-muted-foreground pr-1">Say Hello to Stellar Testnet</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl tracking-[-2px] font-medium leading-tight md:leading-[1.15] mb-3 max-w-4xl"
          >
            Your Assets. <br />
            One Fast <span className="font-serif italic font-normal">Network.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg font-normal leading-6 opacity-90 mb-8 max-w-2xl text-[color:var(--color-hero-subtitle)]"
          >
            Stellar helps teams transact quickly, securely,<br />and globally with precision.
          </motion.p>

          {!pubKey && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              onClick={connectWallet}
              className="bg-foreground text-background rounded-full px-8 py-3.5 text-base font-medium z-50 flex items-center gap-2"
            >
              <Wallet size={18} /> Connect Freighter
            </motion.button>
          )}
        </motion.div>

        {/* Dashboard + Video Area */}
        <motion.div
          ref={dashboardRef}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{ y: dashboardY }}
          className="relative w-screen min-h-[500px] mt-12 flex items-center justify-center z-30"
          style={{ marginLeft: 'calc(-50vw + 50%)' }}
        >
          {/* Background Video */}
          <video
            autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
          />

          {/* Dashboard Image OR Live App */}
          {!pubKey ? (
            <img
              src={DASHBOARD_IMG}
              alt="Dashboard UI"
              className="absolute max-w-5xl w-[90%] rounded-2xl mix-blend-luminosity shadow-2xl border border-[color:var(--color-border)] pointer-events-none"
            />
          ) : (
            <div className="absolute z-40 max-w-5xl w-[90%] grid md:grid-cols-2 gap-6 p-6">
              {/* Wallet Panel */}
              <div className="liquid-glass rounded-2xl p-8 shadow-2xl border border-white/10 text-left backdrop-blur-xl">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Wallet /> Wallet Info
                </h2>
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Connected Account</p>
                    <div className="font-mono text-sm break-all opacity-80">
                      {pubKey}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">XLM Balance</p>
                    <div className="text-5xl font-bold font-serif italic">
                      {balance !== null ? `${balance}` : '...'}
                    </div>
                    {balance === "Not Funded" && (
                      <a href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noreferrer" className="text-sm underline mt-2 block opacity-70 hover:opacity-100">
                        Fund account on Stellar Laboratory
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Send Panel */}
              <div className="liquid-glass rounded-2xl p-8 shadow-2xl border border-white/10 text-left backdrop-blur-xl">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Send /> Send XLM
                </h2>
                <form onSubmit={handleSendTransaction} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Destination Address</label>
                    <input
                      type="text" placeholder="G..." value={toAddress} onChange={(e) => setToAddress(e.target.value)} required
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-white/50 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Amount (XLM)</label>
                    <input
                      type="number" step="0.0000001" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-white/50 font-mono text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={txStatus === 'loading' || !toAddress || !amount || balance === "Not Funded"}
                    className="w-full mt-2 bg-white text-black py-3 rounded-lg font-semibold hover:bg-white/90 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
                  >
                    {txStatus === 'loading' ? 'Processing...' : 'Submit Transaction'}
                  </button>
                </form>

                {txStatus && (
                  <div className="mt-4 p-3 rounded-lg border border-white/10 bg-black/20 text-sm">
                    <strong className="block">{txMessage}</strong>
                    {txHash && (
                      <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 opacity-70 hover:opacity-100 underline">
                        View on Stellar Expert <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Gradient */}
          <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-background to-transparent z-30 pointer-events-none"></div>
        </motion.div>
      </section>

      {/* Section 2: Testimonial */}
      <section className="min-h-screen py-24 md:py-32 px-8 md:px-28 flex items-center justify-center bg-background relative z-10">
        <div ref={testimonialContainerRef} className="max-w-3xl mx-auto flex flex-col items-start gap-10">

          <img src={QUOTE_ICON} alt="Quote" className="w-14 h-10 object-contain opacity-80 invert" />

          <div className="text-4xl md:text-5xl font-medium leading-[1.2] flex flex-wrap">
            {words.map((word, i) => {
              const start = i / words.length;
              const end = (i + 1) / words.length;
              const opacity = useTransform(testimonialScroll, [start, end], [0.2, 1]);
              const color = useTransform(testimonialScroll, [start, end], ["hsl(0 0% 35%)", "hsl(0 0% 100%)"]);

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
