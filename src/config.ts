import { Horizon, Networks as StellarNetworks, rpc } from '@stellar/stellar-sdk';

export const CONTRACT_ID = 'CANOYAM53C5Q6DNECYVNIQAQN5VI4GMWRXPGQ6CDTHNZBWPBAJ3A7AYA';
export const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org:443');
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE = StellarNetworks.TESTNET;
export const server = new Horizon.Server(HORIZON_URL);
