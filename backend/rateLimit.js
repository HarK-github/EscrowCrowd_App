// backend/rateLimit.js
// In-memory sliding window rate limiter.
// Dual-keyed: IP (primary, real defense) + wallet address (secondary).
// NOTE: wallet-address limits are trivially bypassed by new keypairs on testnet.
// IP-based limit is the meaningful throttle. Documented upgrade path: Redis for multi-instance.

const store = new Map(); // key -> number[] (timestamps of requests in window)

const WINDOW_MS = 60_000;  // 1 minute
const MAX_PER_IP = 5;      // 5 sponsored txs per IP per minute
const MAX_PER_WALLET = 3;  // 3 per wallet per minute

/**
 * Returns timestamps in the store for a given key that are still within the window.
 * Prunes expired entries in place.
 */
function getWindow(key) {
  const now = Date.now();
  const timestamps = (store.get(key) || []).filter(t => now - t < WINDOW_MS);
  store.set(key, timestamps);
  return timestamps;
}

/**
 * Checks rate limits for an Express request and a wallet address.
 * Throws an Error with a human-readable message if any limit is exceeded.
 * Call AFTER app.set('trust proxy', 1) so req.ip is correct.
 *
 * @param {import('express').Request} req
 * @param {string} walletAddress
 */
export function checkRateLimit(req, walletAddress) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  const ipWindow = getWindow(`ip:${ip}`);
  if (ipWindow.length >= MAX_PER_IP) {
    throw Object.assign(
      new Error(`Rate limit exceeded. Try again in a minute. (IP: ${ip})`),
      { status: 429 }
    );
  }

  const walletWindow = getWindow(`wallet:${walletAddress}`);
  if (walletWindow.length >= MAX_PER_WALLET) {
    throw Object.assign(
      new Error(`Rate limit exceeded for this wallet. Try again in a minute.`),
      { status: 429 }
    );
  }

  // Record this request only after both checks pass
  const now = Date.now();
  ipWindow.push(now);
  store.set(`ip:${ip}`, ipWindow);
  walletWindow.push(now);
  store.set(`wallet:${walletAddress}`, walletWindow);
}
