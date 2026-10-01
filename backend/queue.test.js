// backend/queue.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueSettlement, streamQueue } from './queue.js';
import { createStream, getStreamSnapshot } from './streams.js';
import { processSettlementJob } from './worker.js';

test('Queue & Worker Subsystem', async (t) => {
  await t.test('1. Deduplication drops duplicate settlement jobs within same epoch', async () => {
    const stream = createStream({
      streamId: 'dedup-stream-1',
      totalDeposit: 50_000_000n,
      durationSec: 100n,
      startTime: 1000,
    });

    const job1 = await enqueueSettlement({
      streamId: 'dedup-stream-1',
      claimAmount: '10000000',
    });
    assert.ok(job1.id);

    // Second call within same epoch
    const job2 = await enqueueSettlement({
      streamId: 'dedup-stream-1',
      claimAmount: '10000000',
    });

    // In-memory queue flags deduplication
    assert.equal(job2.deduplicated, true);
  });

  await t.test('2. Worker processes settlement and updates stream state locally', async () => {
    const stream = createStream({
      streamId: 'worker-stream-1',
      totalDeposit: 100_000_000n,
      durationSec: 100n,
      startTime: 1000,
    });

    const mockJob = {
      data: {
        streamId: 'worker-stream-1',
        claimAmount: '25000000',
        contractId: null, // triggers local simulated record
      },
    };

    const result = await processSettlementJob(mockJob);
    assert.equal(result.simulated, true);
    assert.equal(stream.withdrawn, 25_000_000n);

    const snap = getStreamSnapshot('worker-stream-1', 1050);
    assert.equal(snap.withdrawn, '25000000');
    assert.equal(snap.claimable, '25000000'); // 50m earned - 25m withdrawn
  });
});
