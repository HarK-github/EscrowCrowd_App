import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStellar } from '../context/StellarContext';
import glassAnim from '../assets/glassanim.mp4';
import { Navbar } from '../components/Navbar';
import { Testimonial } from '../components/Testimonial';

export function LandingPage() {
  const { pubKey, connectWallet, appError } = useStellar();
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
      </section>
      
      <Testimonial />
    </div>
  );
}
