import { Contract, rpc, nativeToScVal, scValToNative, TransactionBuilder, Networks, Keypair, Account } from '@stellar/stellar-sdk';
const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org:443');
const CONTRACT_ID = 'CAKBK6LDUAYFCIGDMGWGYEXDSRSVCLDJDUXHOSCS2BQYBNZLS3NPFRQS';

async function fetchState() {
    try {
        const dummyKeypair = Keypair.random();
        const dummyAccount = new Account(dummyKeypair.publicKey(), '0');
        const contract = new Contract(CONTRACT_ID);
        const tx = new TransactionBuilder(dummyAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
            .addOperation(contract.call('get_campaign_state'))
            .setTimeout(30)
            .build();
        const response = await rpcServer.simulateTransaction(tx);
        if (rpc.Api.isSimulationSuccess(response)) {
            const resultVal = response.result.retval;
            console.log(scValToNative(resultVal));
        } else {
            console.error("Simulation failed:", response);
        }
    } catch(e) { console.error(e) }
}
fetchState();
