import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, LogOut } from 'lucide-react';
import { useStellar } from '../context/StellarContext';

export function Navbar() {
  const { pubKey, connectWallet, disconnectWallet } = useStellar();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';

  return (
    <nav className="px-8 md:px-28 py-4 flex items-center justify-between z-50 relative">
      <div className="flex items-center gap-12 md:gap-20">
        <Link to="/" className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight">EscrowCrowd</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {!pubKey && (
            <>
              <a href="#" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">How it works</a>
              <a href="#" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">Campaigns</a>
            </>
          )}
          {pubKey && !isDashboard && (
            <Link to="/dashboard" className="px-3 py-2 text-sm font-medium hover:text-muted-foreground transition-colors">
              Dashboard
            </Link>
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
  );
}
