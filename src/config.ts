import { Horizon, Networks as StellarNetworks, rpc } from '@stellar/stellar-sdk';

export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID || 'CANOYAM53C5Q6DNECYVNIQAQN5VI4GMWRXPGQ6CDTHNZBWPBAJ3A7AYA';
export const rpcServer = new rpc.Server(import.meta.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443');
export const HORIZON_URL = import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE = import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || StellarNetworks.TESTNET;
export const server = new Horizon.Server(HORIZON_URL);
