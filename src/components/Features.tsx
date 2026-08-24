import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, RefreshCcw, Activity } from 'lucide-react';

const features = [
  {
    icon: <ShieldCheck size={28} className="text-white" />,
    title: 'Smart Contract Escrow',
    description: 'Funds are securely locked in a Soroban smart contract on the Stellar network. No intermediaries can access the funds.'
  },
  {
    icon: <Activity size={28} className="text-white" />,
    title: 'Real-Time Tracking',
    description: 'Experience live synchronization with the blockchain. Dashboard feeds update instantly via Soroban RPC.'
  },
  {
    icon: <RefreshCcw size={28} className="text-white" />,
    title: 'Refund Protection',
    description: 'If a project fails to meet its funding goal by the deadline, your XLM is automatically available for refund.'
  },
  {
    icon: <Zap size={28} className="text-white" />,
    title: 'Stellar Speed',
    description: 'Built on the Stellar Testnet for sub-second settlement times and fractions of a cent in transaction fees.'
  }
];

export function Features() {
  return (
    <section className="py-24 md:py-32 px-6 bg-black relative z-10 border-t border-white/10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            Trustless Crowdfunding.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our dApp redefines how projects are funded by leveraging the speed, scale, and security of Stellar smart contracts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="liquid-glass rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mb-6">
                {feat.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{feat.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {feat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
