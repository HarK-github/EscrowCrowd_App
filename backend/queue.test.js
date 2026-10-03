// backend/queue.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueSponsorTx, sponsorQueue } from './queue.js';
import { startWorker } from './worker.js';

test('Sponsor Queue & Worker Subsystem', async (t) => {
  await t.test('1. Sequential execution through in-memory queue', async () => {
    const executedOrder = [];

    // Temporarily replace worker handler on the in-memory queue
    sponsorQueue.setWorker(async (job) => {
      executedOrder.push(`start:${job.data.id}`);
      await new Promise((r) => setTimeout(r, 20));
      executedOrder.push(`end:${job.data.id}`);
      return { success: true, txHash: `hash-${job.data.id}` };
    });

    const p1 = sponsorQueue.add('sponsor_tx', { id: 1 });
    const p2 = sponsorQueue.add('sponsor_tx', { id: 2 });

    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(r1.result.txHash, 'hash-1');
    assert.equal(r2.result.txHash, 'hash-2');
    // Ensure serialization: job 1 finishes before job 2 starts
    assert.deepEqual(executedOrder, ['start:1', 'end:1', 'start:2', 'end:2']);
  });

  await t.test('2. enqueueSponsorTx propagates worker result', async () => {
    sponsorQueue.setWorker(async (job) => {
      assert.equal(job.data.userAddress, 'G_TEST_USER');
      return { success: true, txHash: 'test-hash-xyz' };
    });

    const res = await enqueueSponsorTx({
      innerTxXdr: 'mock-xdr',
      userAddress: 'G_TEST_USER',
    });

    assert.deepEqual(res, { success: true, txHash: 'test-hash-xyz' });
  });

  await t.test('3. enqueueSponsorTx bubbles worker errors', async () => {
    sponsorQueue.setWorker(async () => {
      throw new Error('Simulation failed: Insufficient balance');
    });

    await assert.rejects(
      () => enqueueSponsorTx({ innerTxXdr: 'mock-xdr', userAddress: 'G_TEST_USER' }),
      /Simulation failed: Insufficient balance/
    );
  });

  await t.test('4. startWorker registers handler on sponsorQueue', () => {
    startWorker();
    assert.ok(typeof sponsorQueue.workerHandler === 'function');
  });
});
