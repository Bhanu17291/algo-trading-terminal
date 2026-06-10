import { useEffect, useState } from "react";
import { fetchJson } from "../../config/api";
import { T, fmt } from "../../config/tokens";
import Panel from "../shared/Panel";
import Badge, { SignalBadge } from "../shared/Badge";
import StatCard from "../shared/StatCard";

function TableCell({ children, style }) {
  return (
    <td style={{
      padding: "10px 14px",
      borderBottom: `1px solid ${T.border}`,
      fontFamily: T.fontMono,
      fontSize: 12,
      color: T.text,
      verticalAlign: "middle",
      ...style,
    }}>
      {children}
    </td>
  );
}

function TableHead({ children, style }) {
  return (
    <th style={{
      padding: "10px 14px",
      borderBottom: `2px solid ${T.border}`,
      fontFamily: T.fontMono,
      fontSize: 10,
      color: T.textFaint,
      textTransform: "uppercase",
      letterSpacing: "1.5px",
      fontWeight: 700,
      textAlign: "left",
      background: "rgba(0,0,0,0.2)",
      whiteSpace: "nowrap",
      ...style,
    }}>
      {children}
    </th>
  );
}

function ExitBadge({ type }) {
  if (!type) return <span style={{ color: T.textFaint, fontFamily: T.fontMono, fontSize: 10 }}>—</span>;
  const v = type === "stop_loss" ? "danger" : type === "max_hold" ? "warning" : "info";
  return <Badge variant={v}>{type.replace("_", " ")}</Badge>;
}

export default function TradePage() {
  const [trades, setTrades]   = useState([]);
  const [stats,  setStats]    = useState(null);
  const [pnl,    setPnl]      = useState(null);
  const [filter, setFilter]   = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, st, p] = await Promise.allSettled([
        fetchJson("/trades"),
        fetchJson("/stats"),
        fetchJson("/pnl"),
      ]);
      if (t.status  === "fulfilled") setTrades(t.value || []);
      if (st.status === "fulfilled") setStats(st.value);
      if (p.status  === "fulfilled") setPnl(p.value);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "ALL"
    ? trades
    : trades.filter(t => t.action === filter);

  const wins   = trades.filter(t => t.action === "SELL" && Number(t.pnl) > 0).length;
  const losses = trades.filter(t => t.action === "SELL" && Number(t.pnl) < 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeUp 0.4s ease" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeUp 0.4s ease" }}>

        {/* Page header */}
        <div>
          <div style={{ fontSize: 10, color: T.textFaint, fontFamily: T.fontMono, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>
            Portfolio
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.paleGreen, fontFamily: T.fontSans, margin: 0 }}>
            Trade Log
          </h1>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <StatCard label="Total Return"   value={stats ? fmt.pct(stats.total_return) : "—"} color={T.green} />
          <StatCard label="Win Rate"       value={stats ? fmt.conf(stats.win_rate) : "—"}     color={T.mint} />
          <StatCard label="Total Trades"   value={stats?.total_trades ?? "—"}                  color={T.text} />
          <StatCard label="Wins"           value={wins}                                         color={T.green} icon="▲" />
          <StatCard label="Losses"         value={losses}                                       color={T.red}   icon="▼" />
          <StatCard label="Cumulative PnL" value={pnl ? fmt.inr(pnl.cumulative_pnl) : "—"}    color={pnl?.cumulative_pnl >= 0 ? T.green : T.red} />
        </div>

        {/* Trade table */}
        <Panel
          title="Trade History"
          accent={T.green}
          padded={false}
          action={
            <div style={{ display: "flex", gap: 6 }}>
              {["ALL", "BUY", "SELL"].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "3px 10px", borderRadius: T.rSm,
                    border: `1px solid ${filter === f ? T.green : T.border}`,
                    background: filter === f ? "rgba(34,197,94,0.12)" : "transparent",
                    color: filter === f ? T.green : T.textDim,
                    fontFamily: T.fontMono, fontSize: 10,
                    letterSpacing: "1px", textTransform: "uppercase",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        >
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 20px", color: T.textDim, fontFamily: T.fontMono, fontSize: 12 }}>
              <div style={{ width: 14, height: 14, border: `2px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Loading trades...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: T.textFaint, fontFamily: T.fontMono, fontSize: 12 }}>
              No trades found
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>PnL</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Exit Type</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => {
                    const pnlVal = Number(t.pnl);
                    const pnlColor = pnlVal > 0 ? T.green : pnlVal < 0 ? T.red : T.textDim;
                    return (
                      <tr
                        key={i}
                        style={{
                          transition: "background 0.15s",
                          cursor: "default",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <TableCell style={{ color: T.textFaint }}>{i + 1}</TableCell>
                        <TableCell style={{ color: T.textDim }}>{t.date}</TableCell>
                        <TableCell>
                          <SignalBadge signal={t.action} />
                        </TableCell>
                        <TableCell>₹{Number(t.price)?.toLocaleString("en-IN")}</TableCell>
                        <TableCell style={{ color: T.textDim }}>{t.qty}</TableCell>
                        <TableCell style={{ color: pnlColor, fontWeight: 700 }}>
                          {pnlVal !== 0
                            ? `${pnlVal > 0 ? "+" : ""}₹${Math.abs(pnlVal).toLocaleString("en-IN")}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{
                              height: 4, width: 60, borderRadius: 2,
                              background: T.border, overflow: "hidden",
                            }}>
                              <div style={{
                                height: "100%",
                                width: `${(Number(t.confidence) * 100).toFixed(0)}%`,
                                background: T.green, borderRadius: 2,
                              }} />
                            </div>
                            <span style={{ color: T.textDim, fontSize: 11 }}>
                              {(Number(t.confidence) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ExitBadge type={t.exit_type} />
                        </TableCell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

      </div>
    </div>
  );
}