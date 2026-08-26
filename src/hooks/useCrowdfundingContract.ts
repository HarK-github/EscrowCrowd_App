import { Contract, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk';
import { rpc } from '@stellar/stellar-sdk';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { CONTRACT_ID, NETWORK_PASSPHRASE, rpcServer, server } from '../config';

export const useCrowdfundingContract = () => {
  const donate = async (
    pubKey: string,
    amountStr: string,
    onStatusChange?: (msg: string) => void
  ): Promise<string> => {
    
    if (onStatusChange) onStatusChange('Preparing transaction...');
    const sourceAccount = await server.loadAccount(pubKey);
    const contract = new Contract(CONTRACT_ID);
    const amountStroops = Math.floor(parseFloat(amountStr) * 10000000).toString();

    const operation = contract.call('donate',
      nativeToScVal(pubKey, { type: 'address' }),
      nativeToScVal(amountStroops, { type: 'i128' })
    );

    let transaction = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const simRes = await rpcServer.simulateTransaction(transaction);
    
    if (rpc.Api.isSimulationError(simRes)) {
      throw new Error(typeof simRes.error === 'string' ? simRes.error : JSON.stringify(simRes.error));
    }
    
    if (!rpc.Api.isSimulationSuccess(simRes)) {
      throw new Error("Transaction simulation failed or rejected by contract.");
    }

    transaction = rpc.assembleTransaction(transaction, simRes).build();

    if (onStatusChange) onStatusChange('Please sign in your wallet...');
    const xdr = transaction.toXdr();
    const signResponse = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (!signResponse || !signResponse.signedTxXdr) {
      throw new Error("Failed to sign transaction or transaction rejected.");
    }

    if (onStatusChange) onStatusChange('Submitting to network...');
    const signedTx = TransactionBuilder.fromXdr(signResponse.signedTxXdr, NETWORK_PASSPHRASE);
    const sendRes = await rpcServer.sendTransaction(signedTx as any);
    
    if (sendRes.status === 'ERROR') {
      throw new Error("Transaction submission failed on the network.");
    }
    
    return sendRes.hash;
  };

  return { donate };
};
