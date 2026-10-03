import { Horizon, rpc } from '@stellar/stellar-sdk';

export const CROWDFUND_CONTRACT_ID =
  import.meta.env.VITE_CONTRACT_ID || 'CANOYAM53C5Q6DNECYVNIQAQN5VI4GMWRXPGQ6CDTHNZBWPBAJ3A7AYA';

export const CONTRACT_ID = CROWDFUND_CONTRACT_ID;

export const REWARD_BADGE_CONTRACT_ID =
  import.meta.env.VITE_BADGE_CONTRACT_ID || 'CB2NL3GDXGR36P53NCWXJ57XFKCVGNJAJDQCG4QMHMPEKN3PAKOAPXKM';

export const FACTORY_CONTRACT_ID = 
  import.meta.env.VITE_FACTORY_CONTRACT_ID || 'CDF5SGXM3IP3GQRN4FNK5RXRGO276L6TBJNJXPL2HY5ELFIRCDKIDJQY';

export const CROWDFUND_WASM_HASH = '3d17e3aaf104333e1e449e57bd35e1ee624d71a7c3112ac601996e8cf4911b37';
export const TESTNET_NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

export const NETWORK_LABEL = 'Stellar Testnet';
export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

export const RPC_URL =
  import.meta.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443';

export const HORIZON_URL =
  import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

// Verified on-chain reference transactions
export const VERIFIED_TRANSACTIONS = {
  crowdfundDeployTx: '93e4b3b2fc78ef5bfd1bf4cd31364c0f1c1cf63cb3164767c9c547780957168a',
  crossContractBadgeTx: '515e8f8f639c581bb97a67feae84a5dae0e5045935d45df19a01be6f5f8a1da5',
};

export const getExplorerContractUrl = (contractId: string): string =>
  `https://stellar.expert/explorer/testnet/contract/${contractId}`;

export const getExplorerTxUrl = (txHash: string): string =>
  `https://stellar.expert/explorer/testnet/tx/${txHash}`;

export const getExplorerAccountUrl = (accountId: string): string =>
  `https://stellar.expert/explorer/testnet/account/${accountId}`;

export const rpcServer = new rpc.Server(RPC_URL);
export const server = new Horizon.Server(HORIZON_URL);
