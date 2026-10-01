// src/hooks/useStreamBalance.ts
// 60 FPS requestAnimationFrame client interpolation hook for streaming escrow.
import { useState, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

export interface StreamSnapshot {
  streamId: string;
  totalDeposit: string; // BigInt as string (stroops)
  durationSec: string;
  ratePerSec: string; // BigInt as string (stroops/sec)
  startTime: number;
  frozenAt: number | null;
  frozenSeconds: number;
  withdrawn: string;
  earned: string;
  claimable: string;
  status: 'active' | 'frozen' | 'settled';
}

export interface StreamBalanceState {
  stream: StreamSnapshot | null;
  earnedStroops: bigint;
  claimableStroops: bigint;
  earnedXlm: string;
  claimableXlm: string;
  progressPercent: number;
  isFrozen: boolean;
  isSettled: boolean;
  isConnected: boolean;
}

const STROOP_CONVERSION = 10_000_000;

export function formatStroopsToXlm(stroops: bigint, decimals: number = 4): string {
  const xlm = Number(stroops) / STROOP_CONVERSION;
  return xlm.toFixed(decimals);
}

export function useStreamBalance(streamId: string | null): StreamBalanceState {
  const [stream, setStream] = useState<StreamSnapshot | null>(null);
  const [earnedStroops, setEarnedStroops] = useState<bigint>(0n);
  const [claimableStroops, setClaimableStroops] = useState<bigint>(0n);
  const [earnedXlm, setEarnedXlm] = useState<string>('0.0000');
  const [claimableXlm, setClaimableXlm] = useState<string>('0.0000');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const streamRef = useRef<StreamSnapshot | null>(null);
  const rafRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Sync ref with state
  streamRef.current = stream;

  // 1. WebSocket setup & subscription
  useEffect(() => {
    if (!streamId) {
      setStream(null);
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const socket = io(backendUrl, {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('subscribe_stream', streamId);
    });

    socket.on('stream:snapshot', (snap: StreamSnapshot) => {
      setStream(snap);
    });

    socket.on('stream:frozen', (data: { streamId: string; frozenAt: number }) => {
      setStream((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'frozen',
          frozenAt: data.frozenAt,
        };
      });
    });

    socket.on('stream:resumed', (data: { streamId: string; frozenSeconds: number }) => {
      setStream((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'active',
          frozenAt: null,
          frozenSeconds: data.frozenSeconds,
        };
      });
    });

    socket.on('stream:heartbeat', (snap: StreamSnapshot) => {
      // Periodic server anchor (every 10s) eliminates local client clock drift
      setStream(snap);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.emit('unsubscribe_stream', streamId);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [streamId]);

  // 2. Continuous requestAnimationFrame interpolation loop
  useEffect(() => {
    let active = true;

    const tick = () => {
      if (!active) return;

      const current = streamRef.current;
      if (current) {
        const totalDeposit = BigInt(current.totalDeposit);
        const durationSec = BigInt(current.durationSec);
        const ratePerSec = BigInt(current.ratePerSec);
        const startTime = BigInt(current.startTime);
        const frozenSeconds = BigInt(current.frozenSeconds);
        const withdrawn = BigInt(current.withdrawn);

        const now = BigInt(Math.floor(Date.now() / 1000));
        const effectiveNow =
          current.status === 'frozen' && current.frozenAt !== null
            ? BigInt(current.frozenAt)
            : now;

        const totalElapsed = effectiveNow > startTime ? effectiveNow - startTime : 0n;
        const activeElapsed = totalElapsed > frozenSeconds ? totalElapsed - frozenSeconds : 0n;

        // Dust handling: if duration reached, grant 100% of deposit
        const totalEarned =
          activeElapsed >= durationSec ? totalDeposit : activeElapsed * ratePerSec;
        const cappedEarned = totalEarned > totalDeposit ? totalDeposit : totalEarned;
        const claimable = cappedEarned > withdrawn ? cappedEarned - withdrawn : 0n;

        const pct =
          totalDeposit > 0n
            ? Math.min(100, Number((cappedEarned * 10000n) / totalDeposit) / 100)
            : 0;

        setEarnedStroops(cappedEarned);
        setClaimableStroops(claimable);
        setEarnedXlm(formatStroopsToXlm(cappedEarned));
        setClaimableXlm(formatStroopsToXlm(claimable));
        setProgressPercent(pct);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [streamId]);

  return {
    stream,
    earnedStroops,
    claimableStroops,
    earnedXlm,
    claimableXlm,
    progressPercent,
    isFrozen: stream?.status === 'frozen',
    isSettled: stream?.status === 'settled',
    isConnected,
  };
}
