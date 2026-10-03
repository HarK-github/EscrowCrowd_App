import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useStellar } from '../context/StellarContext';
import glassAnim from '../assets/glassanim.mp4';
import demoPic from '../assets/Stellar-dApp-front.png';
import { Navbar } from '../components/Navbar';
import { Features } from '../components/Features';
import { ContractInfoPanel } from '../components/ContractInfoPanel';

export function LandingPage() {
  const { pubKey, connectWallet, appError, isConnecting } = useStellar();
  const navigate = useNavigate();

  return (
    <div className="font-sans antialiased text-foreground bg-background">
      <section className="relative min-h-screen overflow-hidden flex flex-col">
        <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <video
            autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover blur-md"
            src={glassAnim}
          />
          <div className="absolute inset-0 bg-black/60"></div>
        </div>

        <Navbar />

        <motion.div
          className="relative z-40 mt-8 md:mt-12 px-4 flex flex-col items-center text-center flex-1"
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
            {pubKey ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-foreground text-background rounded-full px-8 py-3.5 text-base font-medium flex items-center gap-2 hover:scale-[1.02] transition-transform"
              >
                Dashboard <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-foreground text-background rounded-full px-8 py-3.5 text-base font-medium flex items-center gap-2 hover:scale-[1.02] transition-transform"
              >
                {isConnecting ? <><Loader2 size={18} className="animate-spin" /> Connecting...</> : <><Wallet size={18} /> Connect Wallet</>}
              </button>
            )}
            {appError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm max-w-md text-center">
                {appError}
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Hero Demo Image */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative z-40 mt-8 max-w-5xl mx-auto px-4 flex justify-center w-full pb-16"
        >
          <img
            src={demoPic}
            alt="App Dashboard on Macbook"
            className="w-full h-auto drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] opacity-90 hover:opacity-100 transition-opacity duration-500"
          />
        </motion.div>
      </section>

      <Features />

      <div className="px-4 py-8 relative z-40">
        <ContractInfoPanel defaultExpanded={false} />
      </div>

      <footer className="relative z-40 border-t border-white/10 bg-black/40 backdrop-blur-md py-12">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-base text-muted-foreground">
            Built by <span className="text-white font-semibold">Harshit Kandpal</span> &copy; {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/HarK-github/EscrowCrowd_App" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-white transition-colors" aria-label="GitHub">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
            </a>
            <a href="#" className="text-muted-foreground hover:text-white transition-colors" aria-label="Twitter">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" className="text-muted-foreground hover:text-white transition-colors" aria-label="LinkedIn">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.77v8.37H6.46v-8.37M7.85 6.46a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z"/></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
