import { useContext } from 'react';
import { StellarContext } from '../context/StellarContext';

export function useStellar() {
  const context = useContext(StellarContext);
  if (context === undefined) {
    throw new Error('useStellar must be used within a StellarProvider');
  }
  return context;
}
