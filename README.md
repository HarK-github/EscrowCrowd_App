# EscrowCrowd: Decentralized Crowdfunding on Stellar

EscrowCrowd is a trustless, decentralized crowdfunding platform built on the Stellar network using Soroban smart contracts. It guarantees that funds are only released to project creators if their funding goals are met. If a project fails to reach its goal by the deadline, backers can safely reclaim their XLM. 

![EscrowCrowd Landing Page Demo](./src/assets/Stellar-dApp-front.png)

## Live Deployment
- **Frontend Vercel Deployment:** [https://escrow-crowd.vercel.app](https://escrow-crowd.vercel.app)
- **Deployed Contract Address:** `CAKBK6LDUAYFCIGDMGWGYEXDSRSVCLDJDUXHOSCS2BQYBNZLS3NPFRQS`
- **Example Transaction (Testnet Explorer):** [06d97e72...](https://stellar.expert/explorer/testnet/tx/06d97e72416e12fe48cbfb0b3866cb4cd4a3bafb27a8d558446a699a59c9cb97)

## Features
- **Smart Contract Escrow:** Absolute trust. Backers' XLM is locked securely by Soroban.
- **Real-Time Blockchain Sync:** Live activity feeds powered by Soroban RPC polling.
- **Automated Refund Protection:** Guaranteed refunds for unmet funding goals.
- **Stellar Speed:** Near-instant settlement on the Stellar Testnet.
- **Modern UI:** Glassmorphism, dynamic animations, and fully responsive bento grid layouts.

## Local Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/harshit-kandpal/EscrowCrowd.git
   cd EscrowCrowd
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   There are no local `.env` variables required to run the application natively! The `CONTRACT_ID`, RPC URL, and Network settings are already seamlessly configured within `src/context/StellarContext.tsx`.

4. **Run the local development server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Prerequisites for Testing**
   - Install a Stellar-compatible wallet browser extension (e.g., [Freighter Wallet](https://www.freighter.app/)).
   - Switch the wallet to the **Stellar Testnet**.
   - Fund your wallet using the [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator).

## Screenshots

### Wallet Connection Options
![Wallet Selection](./screenshots/disconnected.png)

### Connecting Wallet
![Connecting Wallet](./screenshots/connecting.png)

### Dashboard
![Dashboard](./screenshots/dashboard.png)

### Transaction Signature Request
![Transaction Popup](./screenshots/transaction_popup1.png)

### Transaction Successful
![Transaction Complete](./screenshots/transaction%20complete.png)
