/**
 * src/hooks/useBackendWake.js
 *
 * Pings the backend every 3 s until it responds (or 90 s timeout).
 * Returns { awake, elapsed, failed } for the WakeScreen UI.
 */

import { useState, useEffect, useRef } from "react";

const API = "https://algo-trading-terminal.onrender.com";
const PING_MS = 3000;
const MAX_WAIT_MS = 90000;

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
                    signal: AbortSignal.timeout(5000),
                });
                if (res.ok) {
                    awakeRef.current = true;
                    setAwake(true);
                    clearInterval(timerRef.current);
                    clearInterval(pingRef.current);
                }
            } catch {
                // still cold — next ping via interval
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