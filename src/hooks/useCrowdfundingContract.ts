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

export const dummyAccount = (): Account => new Account(Keypair.random().publicKey(), '0');

export const generateSalt = (): Uint8Array => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr;
};

export const pollTransactionConfirmation = async (
  rpcSrv: typeof rpcServer,
  txHash: string,
  maxAttempts: number = 30
): Promise<void> => {
  let status = await rpcSrv.getTransaction(txHash);
  let attempts = 0;
  while (status.status === 'NOT_FOUND' && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2000));
    status = await rpcSrv.getTransaction(txHash);
    attempts++;
  }
  if (status.status !== 'SUCCESS') {
    throw new Error(`Transaction failed: ${status.status}`);
  }
};

export const fetchCampaignStateData = async (contractId: string): Promise<CampaignState | null> => {
  try {
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(dummyAccount(), {
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

export const fetchContractBalance = async (contractId: string): Promise<number> => {
  try {
    const tokenContract = new Contract(TESTNET_NATIVE_SAC);
    const tx = new TransactionBuilder(dummyAccount(), {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(tokenContract.call('balance', nativeToScVal(contractId, { type: 'address' })))
      .setTimeout(30)
      .build();

    const response = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(response)) {
      const resultVal = response.result.retval;
      const balanceStroops = scValToNative(resultVal);
      return Number(balanceStroops) / 10000000;
    }
    return 0;
  } catch (e) {
    console.error('Failed to fetch contract balance:', e);
    return 0;
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
                id: e.txHash,
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

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Universal helper to build, simulate, sign, and submit a Soroban transaction.
 */
export async function submitTransaction(
  pubKey: string,
  operation: any,
  options?: {
    fee?: string;
    timeout?: number;
    pollAttempts?: number;
    onStatusChange?: (msg: string) => void;
  }
): Promise<{ txHash: string; simResult: any }> {
  const onStatusChange = options?.onStatusChange;
  const sourceAccount = await server.loadAccount(pubKey);
  let transaction = new TransactionBuilder(sourceAccount, {
    fee: options?.fee || '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(options?.timeout || 30)
    .build();

  const simRes = await rpcServer.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(simRes)) {
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

  if (!signResponse?.signedTxXdr) {
    throw new Error('Failed to sign transaction or transaction was rejected by user.');
  }

  if (onStatusChange) onStatusChange('Submitting to network...');
  const signedTx = TransactionBuilder.fromXdr(signResponse.signedTxXdr, NETWORK_PASSPHRASE);
  const sendRes = await rpcServer.sendTransaction(signedTx as any);

  if (sendRes.status === 'ERROR') {
    throw new Error('Transaction submission failed on the network.');
  }

  if (onStatusChange) onStatusChange('Waiting for network confirmation...');
  await pollTransactionConfirmation(rpcServer, sendRes.hash, options?.pollAttempts || 15);

  return { txHash: sendRes.hash, simResult: simRes.result?.retval };
}

export const useCrowdfundingContract = (activeContractId: string) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const executeTransaction = (
    pubKey: string,
    operation: any,
    onStatusChange?: (msg: string) => void
  ) => submitTransaction(pubKey, operation, { onStatusChange });

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
   * Gasless donation: builds and signs the inner Soroban transaction as the user,
   * then hands the signed XDR to the backend relayer to wrap in a FeeBumpTransaction.
   * The user still signs with their wallet (they remain the inner source account and
   * their source-account auth covers require_auth(donor) in the contract).
   * Only the fee is sponsored — the donated XLM must exist in the user's account.
   *
   * Returns txHash on success. Throws on validation or network failure.
   */
  const donateGasless = useCallback(
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

        // Build, simulate, and assemble — identical to executeTransaction() up to signing
        const sourceAccount = await server.loadAccount(pubKey);
        let transaction = new TransactionBuilder(sourceAccount, {
          fee: '100',
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(operation)
          // Short time bound required by the backend validator (max 5 minutes)
          .setTimeout(4 * 60)
          .build();

        const simRes = await rpcServer.simulateTransaction(transaction);
        if (rpc.Api.isSimulationError(simRes)) {
          throw new Error(
            typeof simRes.error === 'string' ? simRes.error : JSON.stringify(simRes.error)
          );
        }
        if (!rpc.Api.isSimulationSuccess(simRes)) {
          throw new Error('Transaction simulation failed.');
        }

        transaction = rpc.assembleTransaction(transaction, simRes).build();

        // User signs as the inner source account.
        // They will NOT pay the fee — the sponsor's fee-bump covers it.
        if (onStatusChange) onStatusChange('Please sign in your wallet...');
        const signResponse = await StellarWalletsKit.signTransaction(transaction.toXdr(), {
          networkPassphrase: NETWORK_PASSPHRASE,
        });
        if (!signResponse?.signedTxXdr) {
          throw new Error('Transaction signing was rejected or cancelled.');
        }

        // Send signed XDR to the backend relayer
        if (onStatusChange) onStatusChange('Submitting via gas sponsor...');
        const backendUrl = import.meta.env.VITE_BACKEND_URL;
        if (!backendUrl) throw new Error('Backend URL not configured (VITE_BACKEND_URL).');

        const relayRes = await fetch(`${backendUrl}/api/sponsor-tx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ innerTxXdr: signResponse.signedTxXdr, userAddress: pubKey }),
        });

        const relayData = await relayRes.json();
        if (!relayRes.ok) {
          // Propagate fallback flag so DashboardPage can retry as normal donation
          const err: any = new Error(relayData.error || 'Sponsorship failed.');
          err.fallback = relayData.fallback ?? false;
          err.status = relayRes.status;
          throw err;
        }

        return relayData.txHash as string;
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeContractId]
  );

  /**
   * Withdraws funds from the campaign to the creator.
   */
  const withdraw = useCallback(
    async (
      pubKey: string,
      onStatusChange?: (msg: string) => void
    ): Promise<string> => {
      setIsSubmitting(true);
      try {
        if (onStatusChange) onStatusChange('Preparing withdrawal...');
        const contract = new Contract(activeContractId);

        const operation = contract.call(
          'withdraw',
          nativeToScVal(pubKey, { type: 'address' })
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
   */
  const deployAndCreateCampaign = useCallback(
    async (
      pubKey: string,
      params: { title: string; goalXlm: number; durationMinutes: number },
      onStatusChange?: (status: string) => void
    ): Promise<string> => {
      setIsSubmitting(true);
      try {
        const goalStroops = BigInt(Math.floor(params.goalXlm * 10_000_000));
        const currentTimestampSec = Math.floor(Date.now() / 1000);
        const deadlineSec = currentTimestampSec + (params.durationMinutes * 60);

        return await deployAndInitCrowdfund(
          pubKey,
          {
            token: TESTNET_NATIVE_SAC,
            goal: goalStroops,
            deadline: deadlineSec,
          },
          onStatusChange
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    donate,
    donateGasless,
    withdraw,
    deployAndCreateCampaign,
    isSubmitting,
    fetchCampaignState: fetchCampaignStateData,
    fetchContractBalance,
    fetchRecentEvents: fetchRecentEventsData,
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
  const txOpts = { fee: '1000000', timeout: 120, pollAttempts: 30, onStatusChange };

  // 1. Deploy contract
  if (onStatusChange) onStatusChange('Deploying campaign contract...');
  const createOp = Operation.createCustomContract({
    address: new Address(pubKey),
    wasmHash: hexToBytes(CROWDFUND_WASM_HASH),
    salt: generateSalt(),
  });
  const { simResult: retval } = await submitTransaction(pubKey, createOp, txOpts);
  const contractId: string = scValToNative(retval);
  if (!contractId) throw new Error('Failed to parse deployed contract ID');

  // 2. Initialize campaign
  if (onStatusChange) onStatusChange('Initializing campaign...');
  const contract = new Contract(contractId);
  await submitTransaction(
    pubKey,
    contract.call(
      'create_campaign',
      nativeToScVal(pubKey, { type: 'address' }),
      nativeToScVal(params.token, { type: 'address' }),
      nativeToScVal(params.goal, { type: 'i128' }),
      nativeToScVal(params.deadline, { type: 'u64' })
    ),
    txOpts
  );

  // 3. Link badge contract
  if (onStatusChange) onStatusChange('Linking reward badge...');
  await submitTransaction(
    pubKey,
    contract.call(
      'set_badge_contract',
      nativeToScVal(pubKey, { type: 'address' }),
      nativeToScVal(REWARD_BADGE_CONTRACT_ID, { type: 'address' })
    ),
    txOpts
  );

  return contractId;
}
