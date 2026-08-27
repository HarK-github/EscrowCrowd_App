import { Horizon, rpc } from '@stellar/stellar-sdk';
import {
  CROWDFUND_CONTRACT_ID,
  RPC_URL,
  HORIZON_URL,
  NETWORK_PASSPHRASE,
} from './config/contracts';

export * from './config/contracts';

export const CONTRACT_ID = CROWDFUND_CONTRACT_ID;
export const rpcServer = new rpc.Server(RPC_URL);
export const server = new Horizon.Server(HORIZON_URL);
export { NETWORK_PASSPHRASE, HORIZON_URL };
