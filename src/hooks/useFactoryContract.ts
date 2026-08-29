import { useState, useCallback } from 'react';
import {
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  Account,
  Keypair,
  Networks,
} from '@stellar/stellar-sdk';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { 
  NETWORK_PASSPHRASE, 
  rpcServer, 
  server, 
  FACTORY_CONTRACT_ID,
  TESTNET_NATIVE_SAC,
} from '../config';
import { fetchCampaignStateData } from './useCrowdfundingContract';
import { deployAndInitCrowdfund } from './useCrowdfundingContract';

export interface CampaignSummary {
  address: string;
  creator: string;
  title: string;
  createdAt: number;
}

// Dummy account for simulation-only (read-only) calls
function dummyAccount(): Account {
  return new Account(Keypair.random().publicKey(), '0');
}

async function sendAndConfirm(
  rpcSrv: typeof rpcServer,
  signedXdr: string
): Promise<void> {
  const tx = TransactionBuilder.fromXdr(signedXdr, NETWORK_PASSPHRASE);
  const sendRes = await rpcSrv.sendTransaction(tx as any);
  if (sendRes.status === 'ERROR') {
    throw new Error('Transaction submission failed.');
  }
  let status = await rpcSrv.getTransaction(sendRes.hash);
  let attempts = 0;
  while (status.status === 'NOT_FOUND' && attempts < 30) {
    await new Promise(r => setTimeout(r, 2000));
    status = await rpcSrv.getTransaction(sendRes.hash);
    attempts++;
  }
  if (status.status !== 'SUCCESS') {
    throw new Error(`Transaction failed on-chain: ${status.status}`);
  }
}

export function useFactoryContract() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAllCampaigns = useCallback(async (offset: number = 0, limit: number = 100): Promise<string[]> => {
    try {
      const contract = new Contract(FACTORY_CONTRACT_ID);
      const tx = new TransactionBuilder(dummyAccount(), {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'get_all_campaigns', 
            nativeToScVal(offset, { type: 'u32' }), 
            nativeToScVal(limit, { type: 'u32' })
          )
        )
        .setTimeout(30)
        .build();

      const response = await rpcServer.simulateTransaction(tx);
      if (rpc.Api.isSimulationSuccess(response)) {
        return scValToNative(response.result.retval) as string[];
      }
      return [];
    } catch (e) {
      console.error('Failed to fetch campaigns from registry:', e);
      return [];
    }
  }, []);

  const fetchCampaignMetadata = useCallback(async (address: string): Promise<CampaignSummary | null> => {
    try {
      const contract = new Contract(FACTORY_CONTRACT_ID);
      const tx = new TransactionBuilder(dummyAccount(), {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'get_campaign_metadata', 
            nativeToScVal(address, { type: 'address' })
          )
        )
        .setTimeout(30)
        .build();

      const response = await rpcServer.simulateTransaction(tx);
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = scValToNative(response.result.retval);
        return {
          address,
          creator: result.creator,
          title: result.title,
          createdAt: Number(result.created_at) * 1000,
        };
      }
      return null;
    } catch (e) {
      console.error(`Failed to fetch metadata for ${address}:`, e);
      return null;
    }
  }, []);

  const createCampaign = useCallback(async (
    pubKey: string,
    params: { title: string; goalXlm: number; durationMinutes: number },
    onStatusChange?: (status: string) => void
  ): Promise<string> => {
    setIsSubmitting(true);
    try {
      const goalStroops = BigInt(Math.floor(params.goalXlm * 10_000_000));
      const currentTimestampSec = Math.floor(Date.now() / 1000);
      const deadlineSec = currentTimestampSec + (params.durationMinutes * 60);

      // Step 1: Deploy the CrowdfundContract (user signs + submits)
      if (onStatusChange) onStatusChange('Step 1/2: Deploying campaign contract...');
      const contractId = await deployAndInitCrowdfund(
        pubKey,
        {
          token: TESTNET_NATIVE_SAC,
          goal: goalStroops,
          deadline: deadlineSec,
        },
        onStatusChange
      );

      // Step 2: Register in the Registry (user signs + submits)
      if (onStatusChange) onStatusChange('Step 2/2: Registering in global registry...');
      const sourceAccount = await server.loadAccount(pubKey);
      const registryContract = new Contract(FACTORY_CONTRACT_ID);
      
      let regTx = new TransactionBuilder(sourceAccount, {
        fee: '1000000',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          registryContract.call(
            'register_campaign',
            nativeToScVal(pubKey, { type: 'address' }),
            nativeToScVal(contractId, { type: 'address' }),
            nativeToScVal(params.title, { type: 'string' })
          )
        )
        .setTimeout(120)
        .build();

      const simRes = await rpcServer.simulateTransaction(regTx);
      if (rpc.Api.isSimulationError(simRes)) {
        throw new Error(typeof simRes.error === 'string' ? simRes.error : JSON.stringify(simRes.error));
      }
      regTx = rpc.assembleTransaction(regTx, simRes).build();

      if (onStatusChange) onStatusChange('Please approve registry signature...');
      const signRes = await StellarWalletsKit.signTransaction(regTx.toXdr(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (!signRes?.signedTxXdr) {
        throw new Error('Registry transaction rejected by user.');
      }

      if (onStatusChange) onStatusChange('Confirming registration...');
      await sendAndConfirm(rpcServer, signRes.signedTxXdr);

      return contractId;

    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || 'Campaign creation failed');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    fetchAllCampaigns,
    fetchCampaignMetadata,
    createCampaign,
    isSubmitting
  };
}
