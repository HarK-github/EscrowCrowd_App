import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
const kit = new StellarWalletsKit({ network: Networks.TESTNET, selectedWalletId: 'freighter', modules: [] });
let currentObj = kit;
while (currentObj) {
    console.log(Object.getOwnPropertyNames(currentObj));
    currentObj = Object.getPrototypeOf(currentObj);
}
