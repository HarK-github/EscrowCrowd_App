# EscrowCrowd Soroban Smart Contracts

This directory contains the Soroban smart contracts powering the EscrowCrowd platform on the Stellar network.

## Contracts

### 1. `crowdfund`
The primary crowdfunding smart contract deployed for each campaign:
- **`create_campaign`**: Initializes the campaign with creator address, accepted token (XLM SAC), funding goal (stroops), and Unix deadline.
- **`donate`**: Transfers funds from donor into contract escrow and updates total raised amount and individual contributions.
- **`get_campaign_state`**: Read-only query returning current state (`creator`, `goal`, `deadline`, `total_raised`, `token`, `status`).
- **`withdraw`**: Allows the campaign creator to claim all collected funds once the deadline passes and the funding goal is met.

### 2. `factory`
The global campaign registry contract:
- **`register_campaign`**: Registers a newly deployed `CrowdfundContract` instance with its creator and title metadata.
- **`get_all_campaigns`**: Returns a paginated list of all active/past campaign contract addresses.
- **`get_campaign_metadata`**: Returns metadata (`creator`, `title`, `created_at`) for a registered campaign address.

## Building & Testing

To run tests across all contracts:
```bash
cargo test
```

To build contract WASM bytecode:
```bash
stellar contract build
```
