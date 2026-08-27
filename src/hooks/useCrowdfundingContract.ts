import { useState, useCallback } from 'react';
import {
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  Account,
  Keypair,
} from '@stellar/stellar-sdk';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { CONTRACT_ID, NETWORK_PASSPHRASE, rpcServer, server } from '../config';

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

export const fetchCampaignStateData = async (): Promise<CampaignState | null> => {
  try {
    const dummyAccount = new Account(Keypair.random().publicKey(), '0');
    const contract = new Contract(CONTRACT_ID);
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
  startLedger: number
): Promise<{ events: DonationEvent[]; latestLedger?: number }> => {
  try {
    const eventsRes = await rpcServer.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [CONTRACT_ID],
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

export const useCrowdfundingContract = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Submits a donation transaction to the Crowdfunding contract.
   *
   * Design Decision:
   * 1. In-flight click-guard is enforced via `isSubmitting` and guaranteed to reset in `finally`
   *    so rejected or failed wallet actions never permanently lock the UI.
   * 2. Financial transactions are NEVER silently retried to protect user funds and avoid double-signing.
   */
  const donate = useCallback(
    async (
      pubKey: string,
      amountStr: string,
      onStatusChange?: (msg: string) => void
    ): Promise<string> => {
      // Validate inputs before building transaction
      const parsedAmount = parseFloat(amountStr);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Donation amount must be greater than 0 XLM.');
      }

      setIsSubmitting(true);
      try {
        if (onStatusChange) onStatusChange('Preparing transaction...');
        const sourceAccount = await server.loadAccount(pubKey);
        const contract = new Contract(CONTRACT_ID);
        const amountStroops = Math.floor(parsedAmount * 10000000).toString();

        const operation = contract.call(
          'donate',
          nativeToScVal(pubKey, { type: 'address' }),
          nativeToScVal(amountStroops, { type: 'i128' })
        );

        let transaction = new TransactionBuilder(sourceAccount, {
          fee: '100',
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(operation)
          .setTimeout(30)
          .build();

        const simRes = await rpcServer.simulateTransaction(transaction);

        if (rpc.Api.isSimulationError(simRes)) {
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

        return sendRes.hash;
      } finally {
        // Guaranteed click-guard release
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    donate,
    isSubmitting,
    fetchCampaignState: fetchCampaignStateData,
    fetchRecentEvents: fetchRecentEventsData,
  };
};
