/**
 * src/hooks/useBackendWake.js
 */

import { useState, useEffect, useRef } from "react";

const API = "https://algo-trading-terminal.onrender.com";
const PING_MS = 3000;
const MAX_WAIT_MS = 180000; // 3 min — Render free tier can take ~2 min
const FETCH_TO_MS = 15000; // 15s per ping attempt

export function useBackendWake() {
    const [awake, setAwake] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [failed, setFailed] = useState(false);

    const startRef = useRef(Date.now());
    const timerRef = useRef(null);
    const pingRef = useRef(null);
    const awakeRef = useRef(false);

    useEffect(() => {
        timerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }, 1000);

        async function ping() {
            if (awakeRef.current) return;

            if (Date.now() - startRef.current > MAX_WAIT_MS) {
                setFailed(true);
                clearInterval(timerRef.current);
                clearInterval(pingRef.current);
                return;
            }

            try {
                const res = await fetch(`${API}/signal`, {
                    signal: AbortSignal.timeout(FETCH_TO_MS),
                });
                if (res.ok) {
                    awakeRef.current = true;
                    setAwake(true);
                    clearInterval(timerRef.current);
                    clearInterval(pingRef.current);
                }
            } catch {
                // still cold — retry in PING_MS
            }
        }

        ping();
        pingRef.current = setInterval(ping, PING_MS);

        return () => {
            clearInterval(timerRef.current);
            clearInterval(pingRef.current);
        };
    }, []);

    return { awake, elapsed, failed };
}