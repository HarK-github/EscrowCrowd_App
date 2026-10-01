// backend/streams.js
// Pure O(1) BigInt accrual math and stream state management.
// No external dependencies.

/**
 * In-memory registry of active streams: Map<string, StreamState>
 */
export const streams = new Map();

/**
 * Create and register a new stream.
 * @param {Object} params
 * @param {string|number|bigint} params.streamId
 * @param {number|bigint|string} params.totalDeposit - Total deposit in stroops (1 XLM = 10^7 stroops)
 * @param {number|bigint|string} params.durationSec - Total stream duration in seconds
 * @param {number|bigint|string} [params.startTime] - Unix timestamp in seconds (defaults to now)
 * @param {number|bigint|string} [params.withdrawn=0n] - Previously settled stroops
 * @returns {StreamState}
 */
export function createStream({
  streamId,
  totalDeposit,
  durationSec,
  startTime = Math.floor(Date.now() / 1000),
  withdrawn = 0n,
}) {
  const idStr = String(streamId);
  const total = BigInt(totalDeposit);
  const duration = BigInt(durationSec);
  if (duration <= 0n) throw new Error('durationSec must be > 0');
  if (total <= 0n) throw new Error('totalDeposit must be > 0');

  const stream = {
    streamId: idStr,
    totalDeposit: total,
    durationSec: duration,
    ratePerSec: total / duration,
    startTime: BigInt(startTime),
    frozenAt: null,
    frozenSeconds: 0n,
    withdrawn: BigInt(withdrawn),
    status: 'active',
  };

  streams.set(idStr, stream);
  return stream;
}

/**
 * Calculate instantaneous earned and claimable amounts for a stream.
 * Pure O(1) arithmetic.
 *
 * @param {StreamState} stream
 * @param {number|bigint|string} [currentTimestampSec] - Current time in seconds
 * @returns {{ earned: bigint, claimable: bigint }}
 */
export function calculateClaimable(stream, currentTimestampSec = Math.floor(Date.now() / 1000)) {
  const now = BigInt(currentTimestampSec);
  const effectiveNow =
    stream.status === 'frozen' && stream.frozenAt !== null
      ? stream.frozenAt
      : now;

  const totalElapsed = effectiveNow > stream.startTime ? effectiveNow - stream.startTime : 0n;
  const activeElapsed = totalElapsed > stream.frozenSeconds ? totalElapsed - stream.frozenSeconds : 0n;

  // Remainder dust fix: if active elapsed reaches or exceeds duration, grant 100% of totalDeposit
  const totalEarned =
    activeElapsed >= stream.durationSec
      ? stream.totalDeposit
      : activeElapsed * stream.ratePerSec;

  const cappedEarned = totalEarned > stream.totalDeposit ? stream.totalDeposit : totalEarned;
  const claimable = cappedEarned > stream.withdrawn ? cappedEarned - stream.withdrawn : 0n;

  return { earned: cappedEarned, claimable };
}

/**
 * Freeze an active stream (e.g. on SLA violation or downtime).
 * Stops accrual counter at the current timestamp.
 *
 * @param {string|number|bigint} streamId
 * @param {number|bigint|string} [currentTimestampSec]
 * @returns {StreamState}
 */
export function freezeStream(streamId, currentTimestampSec = Math.floor(Date.now() / 1000)) {
  const stream = streams.get(String(streamId));
  if (!stream) throw new Error(`Stream ${streamId} not found`);
  if (stream.status === 'frozen') return stream; // idempotent
  if (stream.status === 'settled') throw new Error(`Stream ${streamId} is already settled`);

  stream.frozenAt = BigInt(currentTimestampSec);
  stream.status = 'frozen';
  return stream;
}

/**
 * Resume a frozen stream.
 * Calculates duration frozen and adds to accumulated frozenSeconds.
 *
 * @param {string|number|bigint} streamId
 * @param {number|bigint|string} [currentTimestampSec]
 * @returns {StreamState}
 */
export function resumeStream(streamId, currentTimestampSec = Math.floor(Date.now() / 1000)) {
  const stream = streams.get(String(streamId));
  if (!stream) throw new Error(`Stream ${streamId} not found`);
  if (stream.status !== 'frozen') return stream; // idempotent

  const now = BigInt(currentTimestampSec);
  if (stream.frozenAt !== null && now > stream.frozenAt) {
    stream.frozenSeconds += now - stream.frozenAt;
  }
  stream.frozenAt = null;
  stream.status = 'active';
  return stream;
}

/**
 * Record a settlement payout on-chain.
 *
 * @param {string|number|bigint} streamId
 * @param {number|bigint|string} settledAmount
 * @returns {StreamState}
 */
export function recordSettlement(streamId, settledAmount) {
  const stream = streams.get(String(streamId));
  if (!stream) throw new Error(`Stream ${streamId} not found`);

  const amt = BigInt(settledAmount);
  stream.withdrawn += amt;
  if (stream.withdrawn >= stream.totalDeposit) {
    stream.status = 'settled';
  }
  return stream;
}

/**
 * Get stream snapshot for JSON serialization (converts BigInt to strings).
 *
 * @param {string|number|bigint} streamId
 * @param {number|bigint|string} [currentTimestampSec]
 */
export function getStreamSnapshot(streamId, currentTimestampSec = Math.floor(Date.now() / 1000)) {
  const stream = streams.get(String(streamId));
  if (!stream) return null;

  const { earned, claimable } = calculateClaimable(stream, currentTimestampSec);
  return {
    streamId: stream.streamId,
    totalDeposit: stream.totalDeposit.toString(),
    durationSec: stream.durationSec.toString(),
    ratePerSec: stream.ratePerSec.toString(),
    startTime: Number(stream.startTime),
    frozenAt: stream.frozenAt !== null ? Number(stream.frozenAt) : null,
    frozenSeconds: Number(stream.frozenSeconds),
    withdrawn: stream.withdrawn.toString(),
    earned: earned.toString(),
    claimable: claimable.toString(),
    status: stream.status,
  };
}
