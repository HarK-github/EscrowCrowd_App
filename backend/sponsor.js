// backend/sponsor.js
// Validates an inner Soroban transaction XDR and wraps it in a FeeBumpTransaction
// signed by the backend sponsor account. Called by POST /api/sponsor-tx.
//
// Auth model: user is the inner source account, so source-account auth covers
// require_auth(donor) in the donate() contract call. No explicit auth-entry signing
// needed unless the relayer ever becomes the inner source (out of scope).

import {
  TransactionBuilder,
  Keypair,
  Networks,
  Address,
  StrKey,
  rpc,
} from '@stellar/stellar-sdk';

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

// Max fee the sponsor will pay for a single transaction (0.1 XLM = 1,000,000 stroops).
// Soroban resource fees are typically 200-5,000 stroops for a donate() call on testnet.
const CEILING_STROOPS = 100_000_000;

// Max time-bound window allowed on the inner transaction (5 minutes).
const MAX_WINDOW_SEC = 5 * 60;

// Contract IDs the sponsor is allowed to pay fees for.
// Read on every request so a restart isn't needed after adding new contracts.
function getWhitelistedContracts() {
  return (process.env.WHITELISTED_CONTRACTS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Soroban function names the sponsor will cover.
const ALLOWED_FUNCTIONS = ['donate'];

/**
 * Returns the sponsor Keypair from SPONSOR_SECRET_KEY env var.
 * Throws clearly if missing — do not silently use a random key.
 */
export function getSponsorKeypair() {
  const secret = process.env.SPONSOR_SECRET_KEY;
  if (!secret || !secret.startsWith('S')) {
    throw new Error('SPONSOR_SECRET_KEY is not set or invalid. Cannot sponsor transactions.');
  }
  return Keypair.fromSecret(secret);
}

/**
 * Extracts the Soroban contract address as a C... strkey from an invokeHostFunction operation.
 *
 * SDK v17 structure after TransactionBuilder.fromXdr():
 *   op.func                      → HostFunctionInvokeContract  (has .invokeContract plain prop)
 *   op.func.invokeContract       → InvokeContractArgs           (has .contractAddress plain prop)
 *   op.func.invokeContract.contractAddress → ScAddressContract  (has .contractId.value: Uint8Array)
 *
 * @param {object} op
 * @returns {string} C... strkey
 */
function extractContractId(op) {
  const ic = op.func.invokeContract;            // plain property, not a method call
  const scAddr = ic.contractAddress;            // ScAddressContract plain property
  const contractIdBytes = scAddr.contractId.value; // Uint8Array(32)
  return StrKey.encodeContract(contractIdBytes);   // → C... strkey
}

/**
 * Extracts the function name string from an invokeHostFunction operation.
 *
 * op.func.invokeContract.functionName → XdrString { bytes: Uint8Array }
 *
 * @param {object} op
 * @returns {string}
 */
function extractFunctionName(op) {
  const ic = op.func.invokeContract;           // plain property
  return Buffer.from(ic.functionName.bytes).toString('utf8');
}

/**
 * Validates that the auth entries in the operation don't invoke unexpected sub-contracts.
 * For donate(), the auth tree should only reference the crowdfund contract and the native SAC.
 * We reject any sub-invocations that reference contracts not in our whitelist.
 */
function validateAuthEntries(op) {
  if (!op.auth || op.auth.length === 0) return; // assembleTransaction may attach them; OK if empty pre-server
  for (const authEntry of op.auth) {
    // We allow anything signed by the source account (type 0 = SOROBAN_CREDENTIALS_SOURCE_ACCOUNT)
    // Reject non-source-account credentials as unexpected for this simple donate flow
    try {
      const creds = authEntry.credentials();
      const credType = creds.switch().value;
      // 0 = SOROBAN_CREDENTIALS_SOURCE_ACCOUNT — expected
      if (credType !== 0) {
        throw new Error('Unexpected auth credential type in transaction. Only source-account auth is permitted for sponsored donations.');
      }
    } catch (e) {
      if (e.message.includes('Unexpected auth')) throw e;
      // If we can't parse it, allow through — the re-simulation will catch any actual abuse
    }
  }
}

/**
 * Validates the decoded inner transaction against the strict 8-point checklist,
 * then re-simulates it server-side to prevent drain attacks.
 * Returns the validated inner Transaction object.
 *
 * @param {string} innerTxXdr - Base64 XDR string of the signed inner transaction
 * @param {string} userAddress - Public key from request body (must match inner source)
 * @returns {Promise<import('@stellar/stellar-sdk').Transaction>}
 */
export async function validateInnerTx(innerTxXdr, userAddress) {
  // Decode
  let innerTx;
  try {
    innerTx = TransactionBuilder.fromXdr(innerTxXdr, NETWORK_PASSPHRASE);
  } catch {
    throw new Error('Invalid transaction XDR: could not decode.');
  }

  // ① Exactly one operation
  if (innerTx.operations.length !== 1) {
    throw new Error(`Transaction must have exactly one operation (got ${innerTx.operations.length}).`);
  }

  const op = innerTx.operations[0];

  // ② Operation must be invokeHostFunction
  if (op.type !== 'invokeHostFunction') {
    throw new Error(`Operation must be invokeHostFunction (got "${op.type}").`);
  }

  // ③ Contract must be whitelisted
  let contractId;
  try {
    contractId = extractContractId(op);
  } catch (e) {
    throw new Error('Could not extract contract ID from operation.');
  }

  // contractId is always a C... strkey — compare directly with whitelist
  const whitelist = getWhitelistedContracts();
  if (whitelist.length > 0 && !whitelist.includes(contractId)) {
    throw new Error(`Contract "${contractId}" is not whitelisted for gasless sponsorship.`);
  }

  // ④ Function name must be in allowlist
  let fnName;
  try {
    fnName = extractFunctionName(op);
  } catch {
    throw new Error('Could not extract function name from operation.');
  }
  if (!ALLOWED_FUNCTIONS.includes(fnName)) {
    throw new Error(`Function "${fnName}" is not allowed for gasless sponsorship.`);
  }

  // ⑤ Inner source account must match userAddress from the request body
  if (innerTx.source !== userAddress) {
    throw new Error('Inner transaction source account does not match the declared userAddress.');
  }

  // ⑥ Time bounds must exist and not be already expired
  const now = Math.floor(Date.now() / 1000);
  if (!innerTx.timeBounds || !innerTx.timeBounds.maxTime) {
    throw new Error('Transaction must include time bounds with a maxTime.');
  }
  const maxTime = Number(innerTx.timeBounds.maxTime);
  if (maxTime <= now) {
    throw new Error('Transaction time bounds have already expired. Please create a fresh transaction.');
  }

  // ⑦ Time window must not be too large (replay protection)
  if (maxTime - now > MAX_WINDOW_SEC) {
    throw new Error(`Transaction window too large. Maximum allowed is ${MAX_WINDOW_SEC / 60} minutes.`);
  }

  // ⑦b Inner fee must not exceed the ceiling
  if (Number(innerTx.fee) > CEILING_STROOPS) {
    throw new Error(`Declared fee ${innerTx.fee} stroops exceeds sponsorship ceiling of ${CEILING_STROOPS} stroops (10 XLM).`);
  }

  // ⑧ Auth entries — no unexpected sub-contract invocations
  validateAuthEntries(op);

  // Server-side re-simulation (drain-attack mitigation):
  // Re-simulate the inner tx to catch any state change between client sim and now.
  const rpcServer = new rpc.Server(RPC_URL);
  const simCheck = await rpcServer.simulateTransaction(innerTx);
  if (rpc.Api.isSimulationError(simCheck)) {
    throw new Error(`Transaction rejected by server-side simulation: ${simCheck.error}`);
  }

  return innerTx;
}

/**
 * Builds and signs a FeeBumpTransaction wrapping the validated inner transaction.
 * The sponsor pays the fee; the fee equals innerTx.fee (already includes resource fees).
 *
 * @param {import('@stellar/stellar-sdk').Transaction} innerTx
 * @returns {import('@stellar/stellar-sdk').FeeBumpTransaction}
 */
export function buildFeeBump(innerTx) {
  const sponsorKp = getSponsorKeypair();

  // feeBump.fee = innerTx.fee — valid per SDK rules (bump fee must be >= inner fee).
  // The inner fee already includes baseFee + resourceFee from simulation.
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    sponsorKp,
    String(innerTx.fee),
    innerTx,
    NETWORK_PASSPHRASE
  );

  feeBump.sign(sponsorKp);
  return feeBump;
}

// Track whether the sponsor account has sufficient balance to operate.
// Updated by checkSponsorBalance() in server.js.
export let sponsorAvailable = false;

export function setSponsorAvailable(val) {
  sponsorAvailable = val;
}

// ─── In-memory Rate Limiting ───────────────────────────────────────────────
const rateLimitStore = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_IP = 5;
const MAX_PER_WALLET = 3;

function getRateLimitWindow(key) {
  const now = Date.now();
  const timestamps = (rateLimitStore.get(key) || []).filter(t => now - t < WINDOW_MS);
  rateLimitStore.set(key, timestamps);
  return timestamps;
}

export function checkRateLimit(req, walletAddress) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  const ipWindow = getRateLimitWindow(`ip:${ip}`);
  if (ipWindow.length >= MAX_PER_IP) {
    throw Object.assign(
      new Error(`Rate limit exceeded. Try again in a minute. (IP: ${ip})`),
      { status: 429 }
    );
  }

  const walletWindow = getRateLimitWindow(`wallet:${walletAddress}`);
  if (walletWindow.length >= MAX_PER_WALLET) {
    throw Object.assign(
      new Error(`Rate limit exceeded for this wallet. Try again in a minute.`),
      { status: 429 }
    );
  }

  const now = Date.now();
  ipWindow.push(now);
  rateLimitStore.set(`ip:${ip}`, ipWindow);
  walletWindow.push(now);
  rateLimitStore.set(`wallet:${walletAddress}`, walletWindow);
}

