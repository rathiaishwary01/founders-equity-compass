import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeSnaps,
  calcPayouts,
  founderPayouts,
  fmtM,
  fmtVal,
  latestSnap,
} from "@/lib/equity/calc";
import {
  DEFAULT_STATE,
  HOLDER_COLORS,
  INITIAL_HOLDERS,
  ROUND_BENCHMARKS,
  ROUND_ICONS,
  ROUND_LABELS,
  type RoundConfig,
  type RoundKey,
  type SimulatorState,
} from "@/lib/equity/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  state: SimulatorState;
  onChange: (next: SimulatorState) => void;
  readOnly?: boolean;
}

const ROUND_KEYS: RoundKey[] = ["seed", "a", "b", "c"];

export function Simulator({ state, onChange, readOnly = false }: Props) {
  const snaps = useMemo(() => computeSnaps(state), [state]);
  const snapKeys = Object.keys(snaps);
  const latest = latestSnap(snaps);
  const [capRound, setCapRound] = useState<string>("pre");
  const activeCap = snaps[capRound] ?? latest;

  const updateRound = (k: RoundKey, patch: Partial<RoundConfig>) => {
    if (readOnly) return;
    onChange({ ...state, rounds: { ...state.rounds, [k]: { ...state.rounds[k], ...patch } } });
  };

  const founderPct = latest.holders.filter((h) => h.type === "founder").reduce((s, h) => s + h.pct, 0);
  const vcPct = latest.holders.filter((h) => h.type === "vc").reduce((s, h) => s + h.pct, 0);

  // Founder seats from state (BUG FIX 3)
  const founderSeats = state.founderSeats;
  const totalSeats = founderSeats + 1 + latest.vcSeats;
  const fSeatPct = Math.round((founderSeats / totalSeats) * 100);
  const vSeatPct = Math.round((latest.vcSeats / totalSeats) * 100);
  const iSeatPct = 100 - fSeatPct - vSeatPct;

  const fPayouts = founderPayouts(latest, state.exitValue, state.usePref);
  const founderTotal = fPayouts.reduce((s, f) => s + f.payout, 0);
  const totalPref = (latest.roundData || []).filter((r) => r.type === "vc").reduce((s, r) => s + r.investment * r.prefMult, 0);
  const totalInvested = (latest.roundData || []).filter((r) => r.type === "vc").reduce((s, r) => s + r.investment, 0);
  const allPayouts = calcPayouts(latest, state.exitValue, state.usePref);
  const vcTotal = latest.holders.filter((h) => h.type === "vc").reduce((s, h) => s + (allPayouts[h.name] || 0), 0);

  // Line chart data with dynamic Y max (BUG FIX 2)
  const lineData = snapKeys.map((k) => {
    const row: Record<string, number | string> = { round: snaps[k].label };
    INITIAL_HOLDERS.filter((h) => h.type === "founder").forEach((f) => {
      const h = snaps[k].holders.find((x) => x.name === f.name);
      row[f.name] = h ? Number(h.pct.toFixed(2)) : 0;
    });
    row["Total VC"] = Number(snaps[k].holders.filter((h) => h.type === "vc").reduce((s, h) => s + h.pct, 0).toFixed(2));
    return row;
  });
  const lineMaxRaw = Math.max(
    ...lineData.flatMap((d) => Object.entries(d).filter(([k]) => k !== "round").map(([, v]) => Number(v))),
    10,
  );
  const lineMax = Math.ceil(lineMaxRaw / 10) * 10;

  return (
    <div className="space-y-4 pb-6">
      {/* Summary Pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Founders Combined</div>
          <div className="text-2xl font-extrabold mt-1">{founderPct.toFixed(1)}%</div>
          <div className="text-[11px] text-muted-foreground">{founderPct > 51 ? "Majority" : founderPct > 35 ? "Caution" : "Minority"}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Post-money Val.</div>
          <div className="text-2xl font-extrabold mt-1">{fmtVal(latest.valuation)}</div>
          <div className="text-[11px] text-muted-foreground">{latest.valuation ? latest.label : "Configure rounds"}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Board Control</div>
          <div className="text-2xl font-extrabold mt-1">{latest.vcSeats === 0 ? "✅ Safe" : latest.vcSeats < founderSeats ? "✅ Safe" : latest.vcSeats === founderSeats ? "⚠️ Tied" : "🚨 Lost"}</div>
          <div className="text-[11px] text-muted-foreground">F:{fSeatPct}% V:{vSeatPct}% I:{iSeatPct}%</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total VC Stake</div>
          <div className="text-2xl font-extrabold mt-1">{vcPct.toFixed(1)}%</div>
          <div className="text-[11px] text-muted-foreground">{latest.vcNames.length ? latest.vcNames.join(", ") : "No rounds yet"}</div>
        </Card>
      </div>

      <Tabs defaultValue="rounds" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rounds">⚙️ Rounds</TabsTrigger>
          <TabsTrigger value="captable">📋 Cap Table</TabsTrigger>
          <TabsTrigger value="board">🏛️ Board</TabsTrigger>
          <TabsTrigger value="exit">💰 Exit</TabsTrigger>
        </TabsList>

        {/* ── ROUNDS ── */}
        <TabsContent value="rounds" className="space-y-3 mt-4">
          {/* Founder seats config (BUG FIX 3) */}
          <Card className="p-4">
            <Label className="text-xs font-semibold">Number of founder board directors</Label>
            <p className="text-xs text-muted-foreground mb-2">Used in all board calculations, voting power, and recommendations.</p>
            <Select
              value={String(founderSeats)}
              disabled={readOnly}
              onValueChange={(v) => onChange({ ...state, founderSeats: parseInt(v, 10) })}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n} seat{n > 1 ? "s" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </Card>

          {ROUND_KEYS.map((k) => {
            const r = state.rounds[k];
            const dil = r.preMoney && r.raise ? (r.raise / (r.preMoney + r.raise)) * 100 : 0;
            const bench = ROUND_BENCHMARKS[k];
            const dilCls = dil === 0 ? "text-muted-foreground" : dil <= bench.hi ? "text-success" : dil <= bench.hi + 5 ? "text-warning" : "text-danger";
            return (
              <Card key={k} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{ROUND_ICONS[k]}</span>
                  <div className="font-bold flex-1">{ROUND_LABELS[k]}</div>
                  <Switch checked={r.enabled} disabled={readOnly} onCheckedChange={(v) => updateRound(k, { enabled: v })} />
                </div>
                {r.enabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Pre-money ($M)</Label>
                        <Input type="number" value={r.preMoney} disabled={readOnly} onChange={(e) => updateRound(k, { preMoney: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Raise ($M)</Label>
                        <Input type="number" value={r.raise} disabled={readOnly} onChange={(e) => updateRound(k, { raise: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">ESOP post (%)</Label>
                        <Input type="number" value={r.esop} disabled={readOnly} onChange={(e) => updateRound(k, { esop: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">VC Board Seat</Label>
                        <Select value={r.board} disabled={readOnly} onValueChange={(v) => updateRound(k, { board: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="observer">Observer only</SelectItem>
                            <SelectItem value="1">1 Full seat</SelectItem>
                            <SelectItem value="2">2 Full seats</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Liq Pref Multiple</Label>
                        <Select value={String(r.prefMult)} disabled={readOnly} onValueChange={(v) => updateRound(k, { prefMult: parseFloat(v) })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1× (Standard)</SelectItem>
                            <SelectItem value="1.5">1.5×</SelectItem>
                            <SelectItem value="2">2× (Aggressive)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Pref Type</Label>
                        <Select value={r.prefType} disabled={readOnly} onValueChange={(v) => updateRound(k, { prefType: v as "non" | "part" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non">Non-participating</SelectItem>
                            <SelectItem value="part">Participating</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-muted rounded-md px-3 py-2">
                      <span className="text-muted-foreground">Dilution this round</span>
                      <span className={cn("font-bold", dilCls)}>{dil.toFixed(1)}% <span className="text-muted-foreground font-normal">(target {bench.lo}–{bench.hi}%)</span></span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {/* ── CAP TABLE ── */}
        <TabsContent value="captable" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="flex gap-2 flex-wrap mb-3">
              {snapKeys.map((k) => (
                <button
                  key={k}
                  onClick={() => setCapRound(k)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border",
                    capRound === k ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border",
                  )}
                >
                  {snaps[k].label}
                </button>
              ))}
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={activeCap.holders} dataKey="pct" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                    {activeCap.holders.map((h, i) => (
                      <Cell key={i} fill={HOLDER_COLORS[h.name] || "#888"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toFixed(2) + "%"} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="text-[10px] uppercase text-muted-foreground border-b">
                  <th className="text-left py-2">Stakeholder</th>
                  <th className="text-right py-2">%</th>
                  <th className="text-right py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {[...activeCap.holders].sort((a, b) => b.pct - a.pct).map((h, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2"><strong>{h.name}</strong><div className="text-[10px] text-muted-foreground">{h.role}</div></td>
                    <td className="text-right font-bold py-2" style={{ color: HOLDER_COLORS[h.name] }}>{h.pct.toFixed(2)}%</td>
                    <td className="text-right py-2"><Badge variant="secondary">{h.type}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-4">
            <div className="font-bold text-sm mb-3">📉 Dilution over time</div>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, lineMax]} tickFormatter={(v) => v + "%"} />
                  <Tooltip formatter={(v: number) => v.toFixed(2) + "%"} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  {INITIAL_HOLDERS.filter((h) => h.type === "founder").map((f) => (
                    <Line key={f.name} type="monotone" dataKey={f.name} stroke={HOLDER_COLORS[f.name]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                  <Line type="monotone" dataKey="Total VC" stroke="#e74c3c" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* ── BOARD ── */}
        <TabsContent value="board" className="space-y-3 mt-4">
          {snapKeys.map((k) => {
            const snap = snaps[k];
            const total = founderSeats + 1 + snap.vcSeats;
            const fp = Math.round((founderSeats / total) * 100);
            const vp = Math.round((snap.vcSeats / total) * 100);
            const ip = 100 - fp - vp;
            const tied = snap.vcSeats === founderSeats && snap.vcSeats > 0;
            const danger = snap.vcSeats > founderSeats;
            return (
              <Card key={k} className="p-4">
                <div className="text-[11px] font-bold uppercase text-muted-foreground mb-2">{snap.label}</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Array.from({ length: founderSeats }).map((_, i) => (
                    <div key={"f" + i} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/30">Founder {i + 1}</div>
                  ))}
                  <div className="px-3 py-1.5 rounded-md text-xs font-semibold bg-success/10 text-success border border-success/30">Independent{tied ? " 🔑" : ""}</div>
                  {Array.from({ length: snap.vcSeats }).map((_, i) => (
                    <div key={"v" + i} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-danger/10 text-danger border border-danger/30">{snap.vcNames[i] || "VC"}</div>
                  ))}
                  {Array.from({ length: snap.vcObs }).map((_, i) => (
                    <div key={"o" + i} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-warning/10 text-warning-foreground border border-warning/40 border-dashed">Observer</div>
                  ))}
                </div>
                <div className="flex h-2 rounded-full overflow-hidden mb-2">
                  <div className="bg-primary" style={{ width: fp + "%" }} />
                  <div className="bg-danger" style={{ width: vp + "%" }} />
                  <div className="bg-success" style={{ width: ip + "%" }} />
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span>● Founders {fp}%</span><span>● VCs {vp}%</span><span>● Independent {ip}%</span>
                </div>
                <div className={cn(
                  "mt-2 inline-block text-[11px] font-bold px-3 py-1 rounded-full",
                  danger ? "bg-danger/10 text-danger" : tied ? "bg-warning/15 text-warning-foreground" : "bg-success/10 text-success",
                )}>
                  {danger ? `VC-controlled: ${vp}% vs founders ${fp}%` : tied ? `Tied — independent decides` : `Founder-controlled: ${fp}% vs ${vp}%`}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── EXIT ── */}
        <TabsContent value="exit" className="space-y-3 mt-4">
          <Card className="p-4">
            <Label className="text-xs font-semibold">Exit Valuation: {fmtM(state.exitValue)}</Label>
            <Slider
              min={1}
              max={500}
              step={1}
              value={[state.exitValue]}
              disabled={readOnly}
              onValueChange={(v) => onChange({ ...state, exitValue: v[0] })}
              className="mt-3"
            />
            <Input
              type="number"
              value={state.exitValue}
              disabled={readOnly}
              onChange={(e) => onChange({ ...state, exitValue: parseFloat(e.target.value) || 0 })}
              className="mt-3"
            />
            <div className="flex items-center gap-3 mt-3 p-2 bg-muted rounded-md">
              <Switch checked={state.usePref} disabled={readOnly} onCheckedChange={(v) => onChange({ ...state, usePref: v })} />
              <Label className="text-xs">Apply liquidation preferences</Label>
            </div>
          </Card>

          {state.exitValue <= totalPref && state.usePref && totalPref > 0 && (
            <Card className="p-3 bg-danger/10 border-danger/30">
              <div className="text-xs font-bold text-danger">⚠️ Exit value is below total liquidation preferences. Founders receive nothing.</div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">VC Overhang</div>
              <div className="text-lg font-extrabold mt-1">{fmtM(state.usePref ? totalPref : 0)}</div>
              <div className="text-[10px] text-muted-foreground">Paid before founders</div>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">Founders Total</div>
              <div className="text-lg font-extrabold mt-1">{fmtM(founderTotal)}</div>
              <div className="text-[10px] text-muted-foreground">Combined take-home</div>
            </Card>
            <Card className="p-3 col-span-2">
              {/* BUG FIX 5 — Individual Payouts table instead of avg */}
              <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-2">Individual Payouts</div>
              <table className="w-full text-xs">
                <tbody>
                  {fPayouts.map((f) => (
                    <tr key={f.name} className="border-b last:border-0">
                      <td className="py-1.5"><strong>{f.name}</strong> <span className="text-muted-foreground">({f.role})</span></td>
                      <td className="py-1.5 text-right font-bold" style={{ color: HOLDER_COLORS[f.name] }}>{fmtM(f.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="p-3 col-span-2">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">VC Return</div>
              <div className="text-lg font-extrabold mt-1">{totalInvested > 0 ? (vcTotal / totalInvested).toFixed(1) + "×" : "—"}</div>
              <div className="text-[10px] text-muted-foreground">{totalInvested > 0 ? `${fmtM(totalInvested)} invested` : "No rounds yet"}</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="font-bold text-sm mb-3">📊 Payout Breakdown</div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={latest.holders.filter((h) => (allPayouts[h.name] || 0) > 0).map((h) => ({ name: h.name.split(" ")[0], val: allPayouts[h.name] || 0, fullName: h.name }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtM(v)} />
                  <Tooltip formatter={(v: number) => fmtM(v)} />
                  <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                    {latest.holders.filter((h) => (allPayouts[h.name] || 0) > 0).map((h, i) => (
                      <Cell key={i} fill={HOLDER_COLORS[h.name] || "#888"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { DEFAULT_STATE };
