import { useState, useCallback } from 'react';
import {
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  Account,
  Keypair,
  Address,
  Operation,
} from '@stellar/stellar-sdk';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { 
  NETWORK_PASSPHRASE, 
  rpcServer, 
  server, 
  CROWDFUND_WASM_HASH,
  REWARD_BADGE_CONTRACT_ID,
  TESTNET_NATIVE_SAC
} from '../config';

export type TxStatus = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error';

export interface CampaignState {
  creator: string;
  deadline: number;
  goal: number;
  status: string;
  token: string;
  totalRaised: number;
}

export interface DonationEvent {
  id: string;
  donor: string;
  amount: number;
  timestamp: string;
}

export const fetchCampaignStateData = async (contractId: string): Promise<CampaignState | null> => {
  try {
    const dummyAccount = new Account(Keypair.random().publicKey(), '0');
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_campaign_state'))
      .setTimeout(30)
      .build();

    const response = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(response)) {
      console.error('Simulation error:', response.error);
      return null;
    }
    if (rpc.Api.isSimulationSuccess(response)) {
      const resultVal = response.result.retval;
      const state = scValToNative(resultVal);

      return {
        creator: state.creator,
        deadline: Number(state.deadline),
        goal: Number(state.goal) / 10000000,
        status: state.status,
        token: state.token,
        totalRaised: Number(state.total_raised) / 10000000,
      };
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch campaign state:', e);
    return null;
  }
};

export const fetchRecentEventsData = async (
  contractId: string,
  startLedger: number
): Promise<{ events: DonationEvent[]; latestLedger?: number }> => {
  try {
    const eventsRes = await rpcServer.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId],
        },
      ],
      limit: 100,
    });

    if (eventsRes && eventsRes.events) {
      const parsedEvents = eventsRes.events
        .filter((e) => e.type === 'contract' && e.inSuccessfulContractCall)
        .map((e) => {
          try {
            const topic0 = scValToNative(e.topic[0]);
            if (topic0 === 'donate') {
              const donor = scValToNative(e.topic[1]);
              const amountStroops = scValToNative(e.value);
              const amount = Number(amountStroops) / 10000000;
              return {
                id: e.id,
                donor: donor.toString(),
                amount,
                timestamp: e.ledgerClosedAt,
              };
            }
          } catch (err) {
            console.error('Error parsing event', err);
          }
          return null;
        })
        .filter(Boolean) as DonationEvent[];

      return {
        events: parsedEvents,
        latestLedger: eventsRes.latestLedger,
      };
    }
    return { events: [] };
  } catch (e) {
    console.error('Failed to fetch events:', e);
    return { events: [] };
  }
};

export const useCrowdfundingContract = (activeContractId: string) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Generates a 32-byte salt from a random string using browser crypto API
   */
  const generateSalt = (): Uint8Array => {
    const randomArray = new Uint8Array(32);
    crypto.getRandomValues(randomArray);
    return randomArray;
  };

  /**
   * Helper to build, simulate, sign, and submit a transaction
   */
  const executeTransaction = async (
    pubKey: string,
    operation: any,
    onStatusChange?: (msg: string) => void
  ): Promise<{ txHash: string; simResult: any }> => {
    const sourceAccount = await server.loadAccount(pubKey);
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const simRes = await rpcServer.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(simRes)) {
      // Catch WASM eviction error specifically for better UX
      if (typeof simRes.error === 'string' && simRes.error.includes('WasmIdNotFound')) {
        throw new Error('Deployment is temporarily unavailable (Testnet Reset). Please contact the developer.');
      }
      throw new Error(
        typeof simRes.error === 'string' ? simRes.error : JSON.stringify(simRes.error)
      );
    }

    if (!rpc.Api.isSimulationSuccess(simRes)) {
      throw new Error('Transaction simulation failed or rejected by contract.');
    }

    transaction = rpc.assembleTransaction(transaction, simRes).build();

    if (onStatusChange) onStatusChange('Please sign in your wallet...');
    const xdr = transaction.toXdr();
    const signResponse = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (!signResponse || !signResponse.signedTxXdr) {
      throw new Error('Failed to sign transaction or transaction was rejected by user.');
    }

    if (onStatusChange) onStatusChange('Submitting to network...');
    const signedTx = TransactionBuilder.fromXdr(signResponse.signedTxXdr, NETWORK_PASSPHRASE);
    const sendRes = await rpcServer.sendTransaction(signedTx as any);

    if (sendRes.status === 'ERROR') {
      throw new Error('Transaction submission failed on the network.');
    }

    // Wait for the transaction to be confirmed
    if (onStatusChange) onStatusChange('Waiting for network confirmation...');
    
    // Simple polling for transaction status
    let statusResponse = await rpcServer.getTransaction(sendRes.hash);
    let attempts = 0;
    while (statusResponse.status === 'NOT_FOUND' && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      statusResponse = await rpcServer.getTransaction(sendRes.hash);
      attempts++;
    }

    if (statusResponse.status !== 'SUCCESS') {
      throw new Error(`Transaction failed with status: ${statusResponse.status}`);
    }

    return { txHash: sendRes.hash, simResult: simRes.result.retval };
  };

  /**
   * Submits a donation transaction to the active Crowdfunding contract.
   */
  const donate = useCallback(
    async (
      pubKey: string,
      amountStr: string,
      onStatusChange?: (msg: string) => void
    ): Promise<string> => {
      const parsedAmount = parseFloat(amountStr);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Donation amount must be greater than 0 XLM.');
      }

      setIsSubmitting(true);
      try {
        if (onStatusChange) onStatusChange('Preparing transaction...');
        const contract = new Contract(activeContractId);
        const amountStroops = Math.floor(parsedAmount * 10000000).toString();

        const operation = contract.call(
          'donate',
          nativeToScVal(pubKey, { type: 'address' }),
          nativeToScVal(amountStroops, { type: 'i128' })
        );

        const { txHash } = await executeTransaction(pubKey, operation, onStatusChange);
        return txHash;
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeContractId]
  );

  /**
   * Deploys a new Crowdfund contract and initializes it with the given parameters.
   * Handles multi-signature flow and saving state.
   */
  const deployAndCreateCampaign = useCallback(
    async (
      pubKey: string,
      params: { title: string; goalXlm: number; durationMinutes: number },
      onStatusChange?: (status: string) => void,
      resumedContractId?: string
    ): Promise<string> => {
      setIsSubmitting(true);
      try {
        let contractId = resumedContractId;

        // Step 1: Deploy Contract if not resuming
        if (!contractId) {
          if (onStatusChange) onStatusChange('Preparing contract deployment...');
          
          const wasmHashBuffer = new Uint8Array(CROWDFUND_WASM_HASH.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
          const createOp = Operation.createCustomContract({
            address: new Address(pubKey),
            wasmHash: wasmHashBuffer,
            salt: generateSalt(),
          });

          const { simResult } = await executeTransaction(pubKey, createOp, onStatusChange);
          contractId = scValToNative(simResult);
          
          if (!contractId) {
            throw new Error('Failed to parse deployed contract ID');
          }
          
          // Persist the draft contract ID so we can resume if the next steps fail
          localStorage.setItem('draftContractId', contractId);
        }

        // Step 2: Initialize Campaign
        if (onStatusChange) onStatusChange('Initializing Escrow Vault...');
        const contract = new Contract(contractId);
        const goalStroops = Math.floor(params.goalXlm * 10000000).toString();
        
        // Calculate deadline in seconds
        const currentTimestampSec = Math.floor(Date.now() / 1000);
        const deadlineSec = currentTimestampSec + (params.durationMinutes * 60);

        const initOp = contract.call(
          'create_campaign',
          nativeToScVal(pubKey, { type: 'address' }),
          nativeToScVal(TESTNET_NATIVE_SAC, { type: 'address' }),
          nativeToScVal(goalStroops, { type: 'i128' }),
          nativeToScVal(deadlineSec, { type: 'u64' })
        );

        await executeTransaction(pubKey, initOp, onStatusChange);

        // Step 3: Link Badge Contract
        if (onStatusChange) onStatusChange('Linking Reward Badge...');
        const linkOp = contract.call(
          'set_badge_contract',
          nativeToScVal(pubKey, { type: 'address' }),
          nativeToScVal(REWARD_BADGE_CONTRACT_ID, { type: 'address' })
        );

        await executeTransaction(pubKey, linkOp, onStatusChange);

        // Cleanup draft on full success
        localStorage.removeItem('draftContractId');
        
        if (onStatusChange) onStatusChange('Success! 🎉');
        return contractId;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    donate,
    deployAndCreateCampaign,
    isSubmitting,
    fetchCampaignState: (id: string) => fetchCampaignStateData(id),
    fetchRecentEvents: (id: string, startLedger: number) => fetchRecentEventsData(id, startLedger),
  };
};

/**
 * Standalone: deploy a Crowdfund contract and initialize it.
 * Returns the new contract ID. Used by useFactoryContract.
 */
export async function deployAndInitCrowdfund(
  pubKey: string,
  params: { token: string; goal: bigint; deadline: number },
  onStatusChange?: (msg: string) => void
): Promise<string> {
  // Reuse the hook instance logic outside of a React component
  // by directly calling the underlying helpers.

  const generateSalt = (): Uint8Array => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return arr;
  };

  const execTx = async (operation: any): Promise<any> => {
    const sourceAccount = await server.loadAccount(pubKey);
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: '1000000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(120)
      .build();

    const simRes = await rpcServer.simulateTransaction(transaction);
    if (rpc.Api.isSimulationError(simRes)) {
      throw new Error(typeof simRes.error === 'string' ? simRes.error : JSON.stringify(simRes.error));
    }
    if (!rpc.Api.isSimulationSuccess(simRes)) {
      throw new Error('Transaction simulation failed.');
    }
    transaction = rpc.assembleTransaction(transaction, simRes).build();

    if (onStatusChange) onStatusChange('Please approve in your wallet...');
    const signRes = await StellarWalletsKit.signTransaction(transaction.toXdr(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    if (!signRes?.signedTxXdr) throw new Error('Transaction rejected by user.');

    const signedTx = TransactionBuilder.fromXdr(signRes.signedTxXdr, NETWORK_PASSPHRASE);
    const sendRes = await rpcServer.sendTransaction(signedTx as any);
    if (sendRes.status === 'ERROR') throw new Error('Transaction submission failed.');

    if (onStatusChange) onStatusChange('Waiting for confirmation...');
    let status = await rpcServer.getTransaction(sendRes.hash);
    let attempts = 0;
    while (status.status === 'NOT_FOUND' && attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      status = await rpcServer.getTransaction(sendRes.hash);
      attempts++;
    }
    if (status.status !== 'SUCCESS') {
      throw new Error(`Transaction failed: ${status.status}`);
    }
    return simRes.result.retval;
  };

  // 1. Deploy contract
  if (onStatusChange) onStatusChange('Deploying campaign contract...');
  const wasmHashBuffer = new Uint8Array(
    CROWDFUND_WASM_HASH.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
  );
  const createOp = Operation.createCustomContract({
    address: new Address(pubKey),
    wasmHash: wasmHashBuffer,
    salt: generateSalt(),
  });
  const retval = await execTx(createOp);
  const contractId: string = scValToNative(retval);
  if (!contractId) throw new Error('Failed to parse deployed contract ID');

  // 2. Initialize campaign
  if (onStatusChange) onStatusChange('Initializing campaign...');
  const contract = new Contract(contractId);
  await execTx(contract.call(
    'create_campaign',
    nativeToScVal(pubKey, { type: 'address' }),
    nativeToScVal(params.token, { type: 'address' }),
    nativeToScVal(params.goal, { type: 'i128' }),
    nativeToScVal(params.deadline, { type: 'u64' })
  ));

  // 3. Link badge contract
  if (onStatusChange) onStatusChange('Linking reward badge...');
  await execTx(contract.call(
    'set_badge_contract',
    nativeToScVal(pubKey, { type: 'address' }),
    nativeToScVal(REWARD_BADGE_CONTRACT_ID, { type: 'address' })
  ));

  return contractId;
}
