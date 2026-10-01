// backend/streams.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStream,
  calculateClaimable,
  freezeStream,
  resumeStream,
  recordSettlement,
  getStreamSnapshot,
  streams,
} from './streams.js';

test('Streaming Accrual Engine', async (t) => {
  await t.test('1. t = startTime yields 0 earned and 0 claimable', () => {
    streams.clear();
    const stream = createStream({
      streamId: 'stream-1',
      totalDeposit: 100_000_000n, // 10 XLM in stroops
      durationSec: 100n,          // 100 seconds => 1_000_000 stroops/sec
      startTime: 1000,
    });

    const { earned, claimable } = calculateClaimable(stream, 1000);
    assert.equal(earned, 0n);
    assert.equal(claimable, 0n);
  });

  await t.test('2. Mid-stream accrues linear proportion', () => {
    streams.clear();
    const stream = createStream({
      streamId: 'stream-2',
      totalDeposit: 100_000_000n,
      durationSec: 100n,
      startTime: 1000,
    });

    // 50 seconds elapsed
    const { earned, claimable } = calculateClaimable(stream, 1050);
    assert.equal(earned, 50_000_000n);
    assert.equal(claimable, 50_000_000n);
  });

  await t.test('3. Freezing halts accrual counter', () => {
    streams.clear();
    const stream = createStream({
      streamId: 'stream-3',
      totalDeposit: 100_000_000n,
      durationSec: 100n,
      startTime: 1000,
    });

    // Freeze at t=1030 (30s elapsed)
    freezeStream('stream-3', 1030);
    assert.equal(stream.status, 'frozen');
    assert.equal(stream.frozenAt, 1030n);

    // At t=1060, earned should still be frozen at t=1030 level (30 * 1_000_000 = 30_000_000)
    const { earned, claimable } = calculateClaimable(stream, 1060);
    assert.equal(earned, 30_000_000n);
    assert.equal(claimable, 30_000_000n);
  });

  await t.test('4. Resuming adds frozen delta and continues accrual', () => {
    streams.clear();
    const stream = createStream({
      streamId: 'stream-4',
      totalDeposit: 100_000_000n,
      durationSec: 100n,
      startTime: 1000,
    });

    // Freeze from 1030 to 1050 (20s frozen)
    freezeStream('stream-4', 1030);
    resumeStream('stream-4', 1050);
    assert.equal(stream.status, 'active');
    assert.equal(stream.frozenSeconds, 20n);
    assert.equal(stream.frozenAt, null);

    // At t=1070: totalElapsed = 70, frozenSeconds = 20, activeElapsed = 50 => 50_000_000n
    const { earned, claimable } = calculateClaimable(stream, 1070);
    assert.equal(earned, 50_000_000n);
    assert.equal(claimable, 50_000_000n);
  });

  await t.test('5. Reaching duration awards full deposit without stroop remainder dust', () => {
    streams.clear();
    // 100 XLM over 3 days (259,200s): 1,000,000,000 / 259,200 = 3,858 stroops/sec
    // 3858 * 259200 = 999,993,600 (leaves 6,400 stroops dust without remainder fix)
    const stream = createStream({
      streamId: 'stream-5',
      totalDeposit: 1_000_000_000n,
      durationSec: 259_200n,
      startTime: 1000,
    });

    const atEnd = calculateClaimable(stream, 1000 + 259_200);
    assert.equal(atEnd.earned, 1_000_000_000n);
    assert.equal(atEnd.claimable, 1_000_000_000n);

    // After duration
    const pastEnd = calculateClaimable(stream, 1000 + 300_000);
    assert.equal(pastEnd.earned, 1_000_000_000n);
    assert.equal(pastEnd.claimable, 1_000_000_000n);
  });

  await t.test('6. Settlement decreases claimable and marks settled when complete', () => {
    streams.clear();
    const stream = createStream({
      streamId: 'stream-6',
      totalDeposit: 100_000_000n,
      durationSec: 100n,
      startTime: 1000,
    });

    // At t=1050, earned=50m, claimable=50m
    recordSettlement('stream-6', 30_000_000n);
    assert.equal(stream.withdrawn, 30_000_000n);

    const check = calculateClaimable(stream, 1050);
    assert.equal(check.earned, 50_000_000n);
    assert.equal(check.claimable, 20_000_000n);

    // Full withdrawal at end
    recordSettlement('stream-6', 70_000_000n);
    assert.equal(stream.status, 'settled');
    const finalCheck = calculateClaimable(stream, 1100);
    assert.equal(finalCheck.claimable, 0n);
  });

  await t.test('7. Snapshot produces clean JSON-serializable strings', () => {
    streams.clear();
    createStream({
      streamId: 'stream-7',
      totalDeposit: 100_000_000n,
      durationSec: 100n,
      startTime: 1000,
    });

    const snap = getStreamSnapshot('stream-7', 1050);
    assert.equal(snap.streamId, 'stream-7');
    assert.equal(snap.totalDeposit, '100000000');
    assert.equal(snap.earned, '50000000');
    assert.equal(snap.claimable, '50000000');
    assert.equal(snap.status, 'active');
  });
});
