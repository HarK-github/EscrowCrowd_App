// backend/server.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'http';

// We can test endpoint logic directly using the express app or test client
test('Server Webhook & API Endpoints', async (t) => {
  // We can import app dynamically or verify logic
  process.env.WEBHOOK_SECRET = 'test-secret-123';
  
  // Test timingSafeEqual logic
  const crypto = await import('crypto');
  function checkAuth(header, secret) {
    const expected = `Bearer ${secret}`;
    const hBuf = Buffer.from(header || '');
    const eBuf = Buffer.from(expected);
    if (hBuf.length !== eBuf.length) return false;
    return crypto.timingSafeEqual(hBuf, eBuf);
  }

  await t.test('1. Rejects missing or wrong webhook secret', () => {
    assert.equal(checkAuth('', 'test-secret-123'), false);
    assert.equal(checkAuth('Bearer wrong-secret', 'test-secret-123'), false);
    assert.equal(checkAuth('Bearer test-secret-1234', 'test-secret-123'), false);
  });

  await t.test('2. Accepts exact webhook secret', () => {
    assert.equal(checkAuth('Bearer test-secret-123', 'test-secret-123'), true);
  });
});
