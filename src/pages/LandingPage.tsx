import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Loader2 } from "lucide-react";
import { FaGithub, FaTwitter, FaLinkedin } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useStellar } from '../hooks/useStellar';
import glassAnim from '../assets/glassanim.mp4';
import demoPic from '../assets/Stellar-dApp-front.png';
import { Navbar } from '../components/Navbar';
import { Features } from '../components/Features';

export function LandingPage() {
  const { pubKey, connectWallet, appError, isConnecting } = useStellar();
  const navigate = useNavigate();

  useEffect(() => {
    if (pubKey) {
      navigate('/dashboard');
    }
  }, [pubKey, navigate]);

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
            <button
              onClick={connectWallet}
              className="bg-foreground text-background rounded-full px-8 py-3.5 text-base font-medium flex items-center gap-2 hover:scale-[1.02] transition-transform"
            >
              {isConnecting ? <><Loader2 size={18} className="animate-spin" /> Connecting...</> : <><Wallet size={18} /> Connect Wallet</>}
            </button>
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

      <footer className="relative z-40 border-t border-white/10 bg-black/40 backdrop-blur-md py-12">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-base text-muted-foreground">
            Built by <span className="text-white font-semibold">Harshit Kandpal</span> &copy; {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/HarK-github/EscrowCrowd_App" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-white transition-colors">
              <FaGithub size={26} />
            </a>
            <a href="#" className="text-muted-foreground hover:text-white transition-colors">
              <FaTwitter size={26} />
            </a>
            <a href="#" className="text-muted-foreground hover:text-white transition-colors">
              <FaLinkedin size={26} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
