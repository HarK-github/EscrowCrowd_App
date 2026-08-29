# EscrowCrowd - Decentralized Crowdfunding Escrow

EscrowCrowd is a decentralized crowdfunding platform built on Stellar's Soroban smart contract network. It ensures absolute trust by locking funds in an all-or-nothing escrow vault on-chain. Funds are only released to the creator if the campaign goal is met before the deadline. If the goal is not met, all backers can claim full refunds.

## 🌟 Key Features

- **All-or-Nothing Escrow Vault**: Trustless fund management ensuring creator accountability.
- **Factory/Registry Pattern**: A `ProjectFactory` contract acts as a master registry, storing metadata for all deployed campaigns, enabling a decentralized index of active projects.
- **Inter-Contract Communication**: Once a user donates over a threshold, the crowdfund contract automatically invokes the `RewardBadge` contract to mint a "Top Supporter" NFT/badge for the donor.
- **Live Testnet Integration**: Fully integrated with the Soroban Testnet using `@stellar/freighter-api` and the Stellar RPC.
- **Responsive UI**: A modern, mobile-responsive, glassy UI built with React, TailwindCSS, and Framer Motion.

---

## 🏗️ Architecture

### 1. `ProjectFactory` (Registry)
Serves as the decentralized index. 
- **Role**: Maintains a `Vec<Address>` of all campaigns and `Map<Address, CampaignSummary>` for metadata.
- **Why**: Soroban currently faces footprint issues when contracts deploy other contracts dynamically on testnet. The Registry pattern elegantly solves this by allowing users to deploy campaigns independently and register them in the master factory, making cross-contract integration seamless.

### 2. `CrowdfundContract` (Escrow Vault)
The core business logic deployed per campaign.
- **State**: Tracks `goal`, `deadline`, `total_raised`, and individual `Donation(Address)` balances.
- **Functions**: `donate`, `withdraw` (only if goal met), `refund` (only if deadline passed and goal not met).

### 3. `RewardBadgeContract` (NFT Minter)
An autonomous badge minter.
- **Role**: Invoked via cross-contract calls from the `CrowdfundContract` when a donor crosses the 100 XLM threshold. 
- **Security**: Ensures that only valid, registered crowdfund contracts can trigger the minting process.

---

## 🔗 Live Testnet Deployments (Verified Transactions)

### Factory Registry Contract
- **Contract ID**: `CDF5SGXM3IP3GQRN4FNK5RXRGO276L6TBJNJXPL2HY5ELFIRCDKIDJQY`
- **Deployment Hash**: `65d755c9603099dc59c40212dbd1bbf8d73b5bd0b85775f058097b6a18d18b2b`

### RewardBadge Contract
- **Contract ID**: `CB2NL3GDXGR36P53NCWXJ57XFKCVGNJAJDQCG4QMHMPEKN3PAKOAPXKM`
- **Deployment Hash**: `f44bda98c1344882aca21dbff9175e3f4c1d9dea07007a065d892faa8cf09366`

---

## 💻 Local Development Setup

### Prerequisites
- Node.js (v20+)
- Rust (v1.81.0) with `wasm32-unknown-unknown` target
- Stellar CLI

### Smart Contracts
1. Navigate to the contracts directory:
   ```bash
   cd contracts
   ```
2. Run the test suite (5 passing tests):
   ```bash
   cargo test
   ```
3. Build the WASM binaries:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```

### Frontend Application
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

---

## 🚀 CI/CD Pipeline
This project is configured with a GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`). On every push to `main`, the pipeline:
1. Installs the Rust toolchain and checks out the repository.
2. Compiles the Soroban smart contracts.
3. Runs the Rust unit tests.
4. Installs NPM dependencies and builds the production React application.

---

## 📹 Submission Links

- **Live Demo (Vercel/Netlify)**: `[Insert Your Link Here]`
- **Demo Video (1-2 min)**: `[Insert Your Link Here]`

*Note: Screenshots of the Mobile Responsive UI, Passing Tests, and CI/CD Pipeline running are attached in the repository as per the submission requirements.*
