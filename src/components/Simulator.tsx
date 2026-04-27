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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  const [expertMode, setExpertMode] = useState(false);
  const [activeTab, setActiveTab] = useState("rounds");
  const [savedScenarios, setSavedScenarios] = useState<
    Array<{
      name: string;
      founderPct: number;
      vcPct: number;
      vcSeats: number;
      totalPref: number;
      founderPayout50: number;
      founderPayout100: number;
      founderPayout200: number;
    }>
  >([]);

  const updateRound = (k: RoundKey, patch: Partial<RoundConfig>) => {
    if (readOnly) return;
    onChange({ ...state, rounds: { ...state.rounds, [k]: { ...state.rounds[k], ...patch } } });
  };

  const updateSafe = <K extends keyof SimulatorState["safe"]>(field: K, value: SimulatorState["safe"][K]) => {
    if (readOnly) return;
    onChange({ ...state, safe: { ...state.safe, [field]: value } });
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

  // ── Input validation ──
  const validationErrors = useMemo(() => {
    const errs: Record<string, string> = {};

    // SAFE validation
    if (state.safe.enabled) {
      if (state.safe.amount <= 0) errs["safe-amount"] = "Amount must be greater than 0";
      if (state.safe.cap <= 0) errs["safe-cap"] = "Valuation cap must be greater than 0";
      if (state.safe.cap < state.safe.amount) errs["safe-cap"] = "Cap should be larger than the SAFE amount";
      if (state.safe.discount < 0 || state.safe.discount > 50) errs["safe-discount"] = "Discount must be between 0% and 50%";
    }

    // Round validation
    ROUND_KEYS.forEach((k) => {
      const r = state.rounds[k];
      if (!r.enabled) return;
      if (!r.preMoney || r.preMoney <= 0) errs[`${k}-pre`] = "Pre-money must be greater than 0";
      if (!r.raise || r.raise <= 0) errs[`${k}-raise`] = "Raise must be greater than 0";
      if (r.preMoney > 0 && r.raise > 0 && r.raise >= r.preMoney) {
        errs[`${k}-raise`] = "Raise is larger than pre-money — VC would own over 50%. Double-check these numbers.";
      }
      if (r.esop < 0 || r.esop > 30) errs[`${k}-esop`] = "ESOP must be between 0% and 30%";
    });

    return errs;
  }, [state.safe, state.rounds]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  const enabledRounds = ROUND_KEYS.filter((k) => state.rounds[k].enabled);
  const roundsEnabledCount = enabledRounds.length;
  const anyRoundsEnabled = roundsEnabledCount > 0;

  const protectData = useMemo(() => {
    return snapKeys.map((k) => {
      const snap = snaps[k];
      const founders = snap.holders.filter((h) => h.type === "founder").reduce((s, h) => s + h.pct, 0);
      return { round: snap.label, founders: Number(founders.toFixed(2)) };
    });
  }, [snapKeys, snaps]);

  const perFounderAmt = useMemo(() => {
    if (!fPayouts.length) return 0;
    return fPayouts.reduce((min, f) => (f.payout < min ? f.payout : min), fPayouts[0].payout);
  }, [fPayouts]);

  const hasParticipatingPreferred = enabledRounds.some((k) => state.rounds[k].prefType === "part");
  const participatingRoundNames = enabledRounds.filter((k) => state.rounds[k].prefType === "part").map((k) => ROUND_LABELS[k]).join(", ");

  const riskSignals = useMemo(() => {
    const signals: Array<{ tone: "red" | "orange" | "yellow" | "green"; text: string }> = [];

    // Signal 1 — Board control
    if (latest.vcSeats >= founderSeats) {
      signals.push({
        tone: "red",
        text: `VCs hold ${latest.vcSeats} board seats — independent director decides all key votes`,
      });
    } else {
      signals.push({
        tone: "green",
        text: `Founder-controlled board: ${founderSeats} vs ${latest.vcSeats} VC seats`,
      });
    }

    // Signal 2 — Equity threshold
    if (founderPct < 26) {
      signals.push({
        tone: "red",
        text: `Founders at ${founderPct.toFixed(1)}% — below 26%, VCs can block ALL major decisions`,
      });
    } else if (founderPct < 51) {
      signals.push({
        tone: "orange",
        text: `Founders at ${founderPct.toFixed(1)}% — lost simple majority`,
      });
    } else if (founderPct < 75) {
      signals.push({
        tone: "yellow",
        text: `Founders at ${founderPct.toFixed(1)}% — VCs have special resolution blocking power`,
      });
    }

    // Signal 3 — VC combined stake
    if (vcPct > 50) {
      signals.push({
        tone: "red",
        text: `VCs combined at ${vcPct.toFixed(1)}% — can override founders on ordinary resolutions`,
      });
    } else if (vcPct > 26) {
      signals.push({
        tone: "orange",
        text: `VCs at ${vcPct.toFixed(1)}% — can veto M&A, SHA changes, new share issuances`,
      });
    }

    // Signal 4 — Preference overhang (only if totalPref > 0)
    if (totalPref > 0) {
      const overhangRatio = state.exitValue > 0 ? totalPref / state.exitValue : 0;
      const tone = overhangRatio > 0.5 ? "red" : overhangRatio > 0.25 ? "orange" : "yellow";
      signals.push({
        tone,
        text: `${fmtM(totalPref)} liquidation overhang — founders receive $0 in any exit below this amount`,
      });
    }

    // Signal 5 — Participating preferred (only if any round has prefType==='part')
    if (hasParticipatingPreferred) {
      signals.push({
        tone: "orange",
        text: `Participating preferred in ${participatingRoundNames} — VCs collect preference then also participate in remaining proceeds`,
      });
    }

    return signals.slice(0, 5);
  }, [
    latest.vcSeats,
    founderSeats,
    founderPct,
    vcPct,
    totalPref,
    state.exitValue,
    hasParticipatingPreferred,
    participatingRoundNames,
  ]);

  const recommendations = useMemo(() => {
    const recs: Array<{ action: string; impact: string; detail: string }> = [];
    const vcSeats = latest.vcSeats;

    if (vcSeats >= founderSeats + 1) {
      recs.push({
        action: `CRITICAL: You have lost board control — VCs hold ${vcSeats} seats vs your ${founderSeats}`,
        impact: "VCs can now remove the CEO, block acquisitions, and override strategy without founder consent",
        detail:
          "Push every round to observer-only except the lead investor. Negotiate founders nominate the independent director. Add unanimous board consent for CEO removal to the SHA.",
      });
    }

    if (vcSeats === founderSeats && vcSeats > 0) {
      recs.push({
        action: `Board is tied ${founderSeats}-${vcSeats}: the independent director decides everything`,
        impact: "Whoever nominates the independent director effectively controls your company",
        detail:
          "Push for: founders have the right to nominate the independent director in the SHA. Independent must not be an LP in any VC fund on the board.",
      });
    }

    if (anyRoundsEnabled) {
      recs.push({
        action: "Set up dual-class shares (10:1 voting) BEFORE your first round closes",
        impact: "Decouples equity dilution from voting control permanently",
        detail:
          "Founders get Class B shares with 10 votes each. Even at 20% equity you retain 70%+ of votes. Cannot be done after VCs invest.",
      });
    }

    if (anyRoundsEnabled && vcSeats >= 1 && vcSeats < founderSeats + 1) {
      recs.push({
        action: "Add a hard cap in your SHA: all VCs combined hold max 2 board seats ever",
        impact: "Without this, each new round demands a seat — you lose board control by Series B",
        detail:
          "SHA clause: 'All investor directors combined shall not exceed 2 seats at any time, regardless of future financing.'",
      });
    }

    if (state.rounds.a.enabled && state.rounds.a.board === "2") {
      recs.push({
        action: "Reduce Series A VC board seats from 2 to 1",
        impact: "Preserves founder board majority through Series B",
        detail:
          "2 VC seats at Series A plus 1 at Series B = founders tied with VCs. The independent director becomes kingmaker.",
      });
    }

    if (hasParticipatingPreferred) {
      recs.push({
        action: "Remove participating preferred — negotiate non-participating across all rounds",
        impact: "Participating preferred means VCs get their money back AND share the remaining exit — founders lose 20-40% of take-home",
        detail:
          "This is the most founder-unfriendly term after board control. Standard market rate is non-participating at every stage.",
      });
    }

    const hasAggressivePref = enabledRounds.some((k) => state.rounds[k].prefMult >= 2);
    if (hasAggressivePref) {
      recs.push({
        action: "Push back on 2× liquidation preference",
        impact: "2× means VCs get double their money before founders see anything",
        detail:
          "1× non-participating is the market standard. Anything above 1× is aggressive — use competing term sheets as leverage.",
      });
    }

    return recs;
  }, [latest.vcSeats, founderSeats, anyRoundsEnabled, state.rounds, enabledRounds, hasParticipatingPreferred]);

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

      {/* Global validation warning */}
      {hasErrors && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-600 font-semibold">
          <span>⚠️</span>
          <span>Some inputs have errors — results may be inaccurate. Check the highlighted fields below.</span>
        </div>
      )}

      {/* Beginner / Expert toggle */}
      <div className="flex items-center justify-end gap-2">
        <span className={cn("text-xs font-semibold", !expertMode ? "text-primary" : "text-muted-foreground")}>Beginner</span>
        <Switch
          checked={expertMode}
          onCheckedChange={(v) => {
            setExpertMode(v);
            if (!v && (activeTab === "veto" || activeTab === "protect")) {
              setActiveTab("rounds");
            }
          }}
        />
        <span className={cn("text-xs font-semibold", expertMode ? "text-primary" : "text-muted-foreground")}>Expert</span>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        if (!expertMode && (v === "veto" || v === "protect")) return;
        setActiveTab(v);
      }} className="w-full">
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="flex w-max min-w-full h-auto gap-1 p-1">
            <TabsTrigger value="rounds" className="flex-shrink-0 text-xs px-3 py-2">⚙️ Rounds</TabsTrigger>
            <TabsTrigger value="captable" className="flex-shrink-0 text-xs px-3 py-2">📋 Cap Table</TabsTrigger>
            <TabsTrigger value="board" className="flex-shrink-0 text-xs px-3 py-2">🏛️ Board</TabsTrigger>
            <TabsTrigger value="veto" className={cn("flex-shrink-0 text-xs px-3 py-2", !expertMode && "opacity-30 pointer-events-none")}>🛡️ Veto</TabsTrigger>
            <TabsTrigger value="protect" className={cn("flex-shrink-0 text-xs px-3 py-2", !expertMode && "opacity-30 pointer-events-none")}>🔒 Protect</TabsTrigger>
            <TabsTrigger value="exit" className="flex-shrink-0 text-xs px-3 py-2">💰 Exit</TabsTrigger>
            <TabsTrigger value="compare" className="flex-shrink-0 text-xs px-3 py-2">📊 Compare</TabsTrigger>
          </TabsList>
        </div>

        {/* ── ROUNDS ── */}
        <TabsContent value="rounds" className="space-y-3 mt-4">
          {/* Founder seats config (BUG FIX 3) */}
          <Card className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs font-semibold">Number of founder board directors</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    <p className="font-bold text-primary mb-1">Founder Directors</p>
                    <p>How many board seats founders control. This flows into board control, voting power, and “safe / tied / lost” recommendations across rounds.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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

          {/* SECTION A — Insight Engine */}
          <Card className="p-4 bg-[#1a1a2e] text-white">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70 mb-2">
              📊 Founder Outcome Summary
            </div>
            <div className="text-sm font-semibold leading-snug">
              {!anyRoundsEnabled ? (
                "Enable funding rounds below to see your outcome summary."
              ) : (
                <>
                  At current plan, founders end with {founderPct.toFixed(1)}% equity across {roundsEnabledCount}{" "}
                  round{roundsEnabledCount === 1 ? "" : "s"}, and take home ~{fmtM(perFounderAmt)} each at a{" "}
                  {fmtM(state.exitValue)} exit.
                </>
              )}
            </div>

            {!!riskSignals.length && (
              <div className="mt-3 space-y-2">
                {riskSignals.map((s, i) => {
                  const dotCls =
                    s.tone === "red"
                      ? "bg-red-500"
                      : s.tone === "orange"
                        ? "bg-orange-500"
                        : s.tone === "yellow"
                          ? "bg-yellow-400"
                          : "bg-emerald-400";
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs text-white/90">
                      <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", dotCls)} />
                      <span>{s.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {expertMode && <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">📝</span>
              <div className="font-bold flex-1">SAFE / Convertible Note</div>
              <Switch
                checked={state.safe.enabled}
                disabled={readOnly}
                onCheckedChange={(v) => updateSafe("enabled", v)}
              />
            </div>

            {state.safe.enabled && (
              <div className="space-y-3">
                <div className="text-xs bg-muted rounded-md px-3 py-2 text-muted-foreground">
                  SAFEs convert to equity at your first priced round. Dilution hits founders at conversion, not when raised.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Amount ($M)</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px] text-xs">
                            <p className="font-bold text-primary mb-1">SAFE Amount</p>
                            <p>Total cash raised via SAFE. Doesn't dilute immediately — converts to shares at your first priced round.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      type="number"
                      value={state.safe.amount}
                      disabled={readOnly}
                      className={validationErrors["safe-amount"] ? "border-red-400" : ""}
                      onChange={(e) => { updateSafe("amount", parseFloat(e.target.value) || 0); }}
                    />
                    {validationErrors["safe-amount"] && <p className="text-[10px] text-red-500 mt-1">{validationErrors["safe-amount"]}</p>}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Valuation Cap ($M)</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px] text-xs">
                            <p className="font-bold text-primary mb-1">Valuation Cap</p>
                            <p>Maximum valuation at which the SAFE converts. Protects early investors if the company grows fast before Seed.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      type="number"
                      value={state.safe.cap}
                      disabled={readOnly}
                      className={validationErrors["safe-cap"] ? "border-red-400" : ""}
                      onChange={(e) => { updateSafe("cap", parseFloat(e.target.value) || 0); }}
                    />
                    {validationErrors["safe-cap"] && <p className="text-[10px] text-red-500 mt-1">{validationErrors["safe-cap"]}</p>}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Discount (%)</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px] text-xs">
                            <p className="font-bold text-primary mb-1">SAFE Discount</p>
                            <p>SAFE investors get shares at X% cheaper than Seed investors. The SAFE takes the better of cap price or discounted price.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      type="number"
                      value={state.safe.discount}
                      disabled={readOnly}
                      className={validationErrors["safe-discount"] ? "border-red-400" : ""}
                      onChange={(e) => { updateSafe("discount", parseFloat(e.target.value) || 0); }}
                    />
                    {validationErrors["safe-discount"] && <p className="text-[10px] text-red-500 mt-1">{validationErrors["safe-discount"]}</p>}
                  </div>
                </div>
              </div>
            )}
          </Card>}

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
                        <div className="flex items-center gap-1.5 mb-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Pre-money ($M)</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px] text-xs">
                                <p className="font-bold text-primary mb-1">Pre-money</p>
                                <p>What investors agree the company is worth before they invest. e.g. $2.5M pre + $0.5M raise → $3M post-money.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input type="number" value={r.preMoney} disabled={readOnly}
                          className={validationErrors[`${k}-pre`] ? "border-red-400" : ""}
                          onChange={(e) => updateRound(k, { preMoney: parseFloat(e.target.value) || 0 })} />
                        {validationErrors[`${k}-pre`] && <p className="text-[10px] text-red-500 mt-1">{validationErrors[`${k}-pre`]}</p>}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Raise ($M)</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px] text-xs">
                                <p className="font-bold text-primary mb-1">Raise</p>
                                <p>Total investment this round. VC % = Raise ÷ (Pre + Raise). Everyone existing dilutes proportionally.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input type="number" value={r.raise} disabled={readOnly}
                          className={validationErrors[`${k}-raise`] ? "border-red-400" : ""}
                          onChange={(e) => updateRound(k, { raise: parseFloat(e.target.value) || 0 })} />
                        {validationErrors[`${k}-raise`] && <p className="text-[10px] text-red-500 mt-1">{validationErrors[`${k}-raise`]}</p>}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">ESOP post (%)</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px] text-xs">
                                <p className="font-bold text-primary mb-1">ESOP post</p>
                                <p>Option pool target after this round closes. Top-up happens pre-investment — dilutes founders, not the VC. VCs typically require 10–15%.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input type="number" value={r.esop} disabled={readOnly}
                          className={validationErrors[`${k}-esop`] ? "border-red-400" : ""}
                          onChange={(e) => updateRound(k, { esop: parseFloat(e.target.value) || 0 })} />
                        {validationErrors[`${k}-esop`] && <p className="text-[10px] text-red-500 mt-1">{validationErrors[`${k}-esop`]}</p>}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">VC Board Seat</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px] text-xs">
                                <p className="font-bold text-primary mb-1">VC Board Seat</p>
                                <p>Observer attends but cannot vote. Full seat = binding vote on CEO removal, M&A, pivots. Prefer observer-only at Seed.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Select value={r.board} disabled={readOnly} onValueChange={(v) => updateRound(k, { board: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="observer">Observer only</SelectItem>
                            <SelectItem value="1">1 Full seat</SelectItem>
                            <SelectItem value="2">2 Full seats</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {expertMode && <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Liq Pref Multiple</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px] text-xs">
                                <p className="font-bold text-primary mb-1">Liquidation Preference Multiple</p>
                                <p>In an exit, VCs get paid this many times their investment before founders see anything. 1× is standard. Push back on 2×.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Select value={String(r.prefMult)} disabled={readOnly} onValueChange={(v) => updateRound(k, { prefMult: parseFloat(v) })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1× (Standard)</SelectItem>
                            <SelectItem value="1.5">1.5×</SelectItem>
                            <SelectItem value="2">2× (Aggressive)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>}
                      {expertMode && <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Pref Type</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px] text-xs">
                                <p className="font-bold text-primary mb-1">Preference Type</p>
                                <p>Non-participating: VC chooses preference OR pro-rata — whichever is higher. Participating: VC gets preference first, then also takes pro-rata. Always push back on participating.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Select value={r.prefType} disabled={readOnly} onValueChange={(v) => updateRound(k, { prefType: v as "non" | "part" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non">Non-participating</SelectItem>
                            <SelectItem value="part">Participating</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>}
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

          {/* SECTION B — Recommendations Card */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-sm">🧭 Recommended Actions</div>
              <Badge className="bg-primary/10 text-primary border border-primary/30">{recommendations.length}</Badge>
            </div>
            {recommendations.length === 0 ? (
              <div className="text-sm text-muted-foreground">Enable funding rounds above to see recommendations.</div>
            ) : (
              <div className="space-y-4">
                {recommendations.map((r, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm leading-snug">{r.action}</div>
                      <div className="text-sm text-indigo-600/90 mt-0.5">{r.impact}</div>
                      <div className="text-xs text-muted-foreground mt-1">{r.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
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
                  <RechartsTooltip formatter={(v: number) => v.toFixed(2) + "%"} />
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
                  <RechartsTooltip formatter={(v: number) => v.toFixed(2) + "%"} />
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

        {/* ── VETO ── */}
        <TabsContent value="veto" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="font-bold text-sm">🛡️ VC Veto Rights — Active Triggers</div>
            <div className="text-xs text-muted-foreground mt-1">
              Tap any item to see what VCs demand, what to push back to, and the exact clause to negotiate.
            </div>

            {(() => {
              const vetoItems: Array<{
                key: string;
                title: string;
                active: boolean;
                demand: string;
                push: string;
                clause: string;
              }> = [
                {
                  key: "equity",
                  title: "New equity issuance approval",
                  active: state.rounds.seed.enabled,
                  demand: "Approval required for any new share issuance, including to advisors or employees.",
                  push: "Carve out: ESOP grants under board-approved plan, advisor grants under $25K, exercises of existing options. Only new round-level issuances need VC approval.",
                  clause: "Deemed approved if VC does not respond in writing within 10 business days of notice.",
                },
                {
                  key: "exec",
                  title: "CEO / executive hiring & firing",
                  active: state.rounds.a.enabled,
                  demand: "VC approval required to hire or remove CEO and all C-suite.",
                  push: "Limit to CEO and CFO only. CEO removal requires 4/5 board votes. Define 'For Cause' narrowly: fraud, criminal conviction, gross negligence.",
                  clause: "Founders removed without Cause receive 6-month salary + full acceleration of unvested equity.",
                },
                {
                  key: "mna",
                  title: "Acquisitions above $500K",
                  active: state.rounds.a.enabled,
                  demand: "Any acquisition above $500K requires VC approval.",
                  push: "Raise threshold to $2M. Carve out acqui-hires under $750K.",
                  clause: "VC must respond within 15 business days or acquisition is deemed approved.",
                },
                {
                  key: "debt",
                  title: "New debt above $250K",
                  active: state.rounds.seed.enabled,
                  demand: "Any new borrowing above $250K requires VC sign-off.",
                  push: "Raise threshold to $1M. Carve out working capital revolving credit lines, equipment financing under $500K, government-backed loans.",
                  clause: "Pre-approved for credit facilities disclosed in SHA schedule.",
                },
                {
                  key: "related",
                  title: "Related party transactions",
                  active: state.rounds.seed.enabled,
                  demand: "Any transaction with founders or affiliated entities needs consent.",
                  push: "Carve out: employment agreements approved by board, expense reimbursements under $10K, arm's-length transactions.",
                  clause: "Board audit committee certification sufficient for transactions under $100K.",
                },
                {
                  key: "windup",
                  title: "Liquidation / winding up",
                  active: state.rounds.seed.enabled,
                  demand: "VC must consent to any voluntary liquidation.",
                  push: "Accept this — it's standard. But push back: requires 75%+ shareholder vote, not a VC unilateral right.",
                  clause: "No single investor can force wind-up without 75% shareholder approval regardless of ownership %.",
                },
                {
                  key: "amend",
                  title: "Amendment of SHA / AoA",
                  active: state.rounds.a.enabled,
                  demand: "Any SHA or AoA change requires VC consent.",
                  push: "VC consent only for amendments affecting VC-specific rights. Administrative changes need 75% shareholder vote only.",
                  clause: "Changes to board composition, liquidation preferences, or anti-dilution require VC consent. All others require 75% shareholder approval.",
                },
                {
                  key: "esop",
                  title: "ESOP pool increase",
                  active: state.rounds.a.enabled,
                  demand: "Any ESOP increase above current level needs VC approval.",
                  push: "Pre-agree an ESOP schedule in the SHA. Increases within schedule need board approval only.",
                  clause: "ESOP increases within pre-agreed SHA schedule require board approval only.",
                },
                {
                  key: "ipo",
                  title: "IPO decision",
                  active: state.rounds.b.enabled,
                  demand: "VCs must approve any IPO filing.",
                  push: "After 5 years, founders can initiate IPO with 51% shareholder vote. VCs cannot veto IPO achieving ≥3× their invested capital.",
                  clause: "VC consent not required if: ≥5 years since investment, IPO at ≥3× cost basis, and 51% of shareholders approve.",
                },
                {
                  key: "div",
                  title: "Dividend declaration",
                  active: state.rounds.seed.enabled,
                  demand: "No dividends without VC approval.",
                  push: "Accept it — standard. Push for carve-out: board-approved bonuses and salary increases are not dividends.",
                  clause: "Performance bonuses approved by board compensation committee are explicitly excluded.",
                },
              ];

              return (
                <div className="mt-4">
                  <Accordion type="single" collapsible className="w-full">
                    {vetoItems.map((it) => (
                      <AccordionItem
                        key={it.key}
                        value={it.key}
                        className={cn(
                          "px-3 rounded-md border mb-2 last:mb-0",
                          it.active ? "border-red-500/60 bg-red-500/5" : "border-border",
                        )}
                      >
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center justify-between w-full pr-2">
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2.5 w-2.5 rounded-full", it.active ? "bg-red-500" : "bg-emerald-400")} />
                              <span className="text-sm font-semibold">{it.title}</span>
                            </div>
                            <Badge className={cn("text-[10px]", it.active ? "bg-red-500/15 text-red-600 border border-red-500/30" : "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30")}>
                              {it.active ? "ACTIVE" : "INACTIVE"}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                          <div className="space-y-3">
                            <div>
                              <div className="text-xs font-bold">⚠️ What VCs demand</div>
                              <div className="text-xs text-muted-foreground mt-1">{it.demand}</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold">✅ Push back to</div>
                              <div className="text-xs text-muted-foreground mt-1">{it.push}</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold">📄 Exact clause to negotiate</div>
                              <div className="text-xs text-muted-foreground mt-1">{it.clause}</div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              );
            })()}
          </Card>

          <Card className="p-4">
            <div className="font-bold text-sm mb-3">🎯 Key Ownership Thresholds</div>
            {(() => {
              const checks = [
                { label: "Founders supermajority (75%)", ok: founderPct > 75, current: founderPct, goodText: "SAFE", badText: "BREACHED" },
                { label: "Founders simple majority (51%)", ok: founderPct > 51, current: founderPct, goodText: "SAFE", badText: "BREACHED" },
                { label: "VC blocking minority (26%)", ok: vcPct < 26, current: vcPct, goodText: "SAFE", badText: "BREACHED" },
                { label: "VC majority risk (50%)", ok: vcPct < 40, current: vcPct, goodText: "SAFE", badText: "BREACHED" },
              ];
              return (
                <div className="space-y-2">
                  {checks.map((c) => (
                    <div key={c.label} className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
                      <div className="text-xs font-semibold">{c.label}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">{c.current.toFixed(1)}%</div>
                        <Badge className={cn("text-[10px]", c.ok ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30" : "bg-red-500/15 text-red-600 border border-red-500/30")}>
                          {c.ok ? c.goodText : c.badText}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        </TabsContent>

        {/* ── PROTECT ── */}
        <TabsContent value="protect" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="font-bold text-sm mb-3">🔒 Founder Control vs. Danger Zones</div>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={protectData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => v + "%"} />
                  <RechartsTooltip formatter={(v: number) => v.toFixed(2) + "%"} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Line type="monotone" dataKey="founders" name="Founders %" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
                  <ReferenceLine y={51} stroke="#22c55e" strokeDasharray="6 4" label={{ value: "Safe", position: "insideTopLeft", fill: "#22c55e", fontSize: 10 }} />
                  <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="6 4" label={{ value: "Danger", position: "insideTopLeft", fill: "#ef4444", fontSize: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-bold text-sm mb-3">🚨 Anti-Takeover Scenarios</div>
            {(() => {
              const items = [
                {
                  title: "VCs accumulate >50% combined",
                  risk: "Multiple VCs bloc-vote to override founders.",
                  defense: "Cap combined VC voting rights at 40% in SHA. Require 30-day notice before VCs coordinate a bloc vote.",
                  badge: "HIGH RISK",
                },
                {
                  title: "Forced down-round dilution",
                  risk: "Full-ratchet anti-dilution wipes out founder stakes.",
                  defense: "Weighted-average only. ESOP issuances and bridge loans excluded.",
                  badge: "HIGH RISK",
                },
                {
                  title: "Founder squeeze-out",
                  risk: "VC pressures a founder out, triggers drag-along for cheap sale.",
                  defense: "'For Cause' requires 4/5 board votes. Full unvested acceleration on unjust termination + 6-month salary.",
                  badge: "MED RISK",
                },
                {
                  title: "Strategic acquirer + VC alliance",
                  risk: "VC sells to hostile strategic who allies with other VCs.",
                  defense: "VC transfers restricted to approved buyer list. Any VC transfer triggers founders' ROFR.",
                  badge: "MED RISK",
                },
              ];
              return (
                <div className="space-y-3">
                  {items.map((it) => (
                    <div key={it.title} className="p-3 rounded-md border border-border">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-bold text-sm">{it.title}</div>
                        <Badge className={cn("text-[10px]", it.badge === "HIGH RISK" ? "bg-red-500/15 text-red-600 border border-red-500/30" : "bg-orange-500/15 text-orange-700 border border-orange-500/30")}>
                          {it.badge}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1"><span className="font-semibold text-foreground">Risk:</span> {it.risk}</div>
                      <div className="text-xs text-muted-foreground mt-1"><span className="font-semibold text-foreground">Defense:</span> {it.defense}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          <Card className="p-4">
            <div className="font-bold text-sm mb-3">📜 Structural Protections Checklist</div>
            {(() => {
              const items = [
                { title: "Dual-class structure in AoA", note: "DO BEFORE SEED", tone: "red", detail: "AoA amendments need 75% approval — hard for VCs to strip." },
                { title: "Accelerated vesting for founders", note: "NEGOTIATE HARD", tone: "orange", detail: "25% vests immediately on VC close, remaining 75% over 3 years." },
                { title: "Mutual ROFR among founders", note: "MUST HAVE", tone: "red", detail: "Any founder selling must first offer shares to co-founders at same price." },
              ] as const;
              const badgeCls = (tone: (typeof items)[number]["tone"]) =>
                tone === "red"
                  ? "bg-red-500/15 text-red-600 border border-red-500/30"
                  : "bg-orange-500/15 text-orange-700 border border-orange-500/30";
              return (
                <div className="space-y-2">
                  {items.map((it) => (
                    <div key={it.title} className="flex items-start justify-between gap-3 bg-muted rounded-md px-3 py-2">
                      <div>
                        <div className="text-sm font-bold">{it.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{it.detail}</div>
                      </div>
                      <Badge className={cn("text-[10px] shrink-0", badgeCls(it.tone))}>{it.note}</Badge>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        </TabsContent>

        {/* ── COMPARE ── */}
        <TabsContent value="compare" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="font-bold text-sm">📊 Scenario Comparison Engine</div>
            <div className="text-xs text-muted-foreground mt-1">
              Save a snapshot of your current scenario, then tweak terms and compare side-by-side. Up to 3 saved scenarios.
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="px-3 py-2 rounded-md bg-foreground text-background text-xs font-bold disabled:opacity-50"
                disabled={!anyRoundsEnabled}
                onClick={() => {
                  if (!anyRoundsEnabled) return;
                  const name = window.prompt("Scenario name?");
                  if (!name) return;

                  const minFounderPayoutAt = (exitVal: number) => {
                    const snaps2 = computeSnaps({ ...state, exitValue: exitVal });
                    const latest2 = latestSnap(snaps2);
                    const payouts2 = founderPayouts(latest2, exitVal, state.usePref);
                    if (!payouts2.length) return 0;
                    return payouts2.reduce((min, f) => (f.payout < min ? f.payout : min), payouts2[0].payout);
                  };

                  const next = {
                    name,
                    founderPct,
                    vcPct,
                    vcSeats: latest.vcSeats,
                    totalPref,
                    founderPayout50: minFounderPayoutAt(50),
                    founderPayout100: minFounderPayoutAt(100),
                    founderPayout200: minFounderPayoutAt(200),
                  };

                  setSavedScenarios((prev) => {
                    const arr = [...prev, next];
                    if (arr.length <= 3) return arr;
                    return arr.slice(arr.length - 3);
                  });
                }}
              >
                📸 Save Current as Scenario
              </button>

              {savedScenarios.length > 0 && (
                <button
                  className="px-3 py-2 rounded-md border border-border text-xs font-bold"
                  onClick={() => setSavedScenarios([])}
                >
                  Clear
                </button>
              )}
            </div>

            {savedScenarios.length === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">
                Enable funding rounds in the Rounds tab, then save a scenario to start comparing.
              </div>
            ) : (
              <div className="mt-4 overflow-auto">
                {(() => {
                  const live = {
                    name: "Live (current)",
                    founderPct,
                    vcPct,
                    vcSeats: latest.vcSeats,
                    totalPref,
                    founderPayout50: (() => {
                      const snaps2 = computeSnaps({ ...state, exitValue: 50 });
                      const latest2 = latestSnap(snaps2);
                      const payouts2 = founderPayouts(latest2, 50, state.usePref);
                      if (!payouts2.length) return 0;
                      return payouts2.reduce((min, f) => (f.payout < min ? f.payout : min), payouts2[0].payout);
                    })(),
                    founderPayout100: (() => {
                      const snaps2 = computeSnaps({ ...state, exitValue: 100 });
                      const latest2 = latestSnap(snaps2);
                      const payouts2 = founderPayouts(latest2, 100, state.usePref);
                      if (!payouts2.length) return 0;
                      return payouts2.reduce((min, f) => (f.payout < min ? f.payout : min), payouts2[0].payout);
                    })(),
                    founderPayout200: (() => {
                      const snaps2 = computeSnaps({ ...state, exitValue: 200 });
                      const latest2 = latestSnap(snaps2);
                      const payouts2 = founderPayouts(latest2, 200, state.usePref);
                      if (!payouts2.length) return 0;
                      return payouts2.reduce((min, f) => (f.payout < min ? f.payout : min), payouts2[0].payout);
                    })(),
                  };

                  const cols = [...savedScenarios, live];
                  const maxOf = (k: keyof typeof live) => Math.max(...cols.map((c) => Number(c[k] as number)));
                  const minOf = (k: keyof typeof live) => Math.min(...cols.map((c) => Number(c[k] as number)));
                  const cellCls = (val: number, best: number, worst: number, higherIsBetter: boolean) => {
                    const isBest = higherIsBetter ? val === best : val === worst;
                    const isWorst = higherIsBetter ? val === worst : val === best;
                    return cn(isBest && "bg-emerald-500/10", isWorst && "bg-red-500/10");
                  };

                  return (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-[10px] uppercase text-muted-foreground border-b">
                          <th className="text-left py-2 pr-3">Metric</th>
                          {cols.map((c) => (
                            <th key={c.name} className="text-right py-2 px-2 whitespace-nowrap">{c.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const rows = [
                            { label: "Founder Equity", key: "founderPct" as const, fmt: (v: number) => v.toFixed(1) + "%", higherIsBetter: true },
                            { label: "VC Stake", key: "vcPct" as const, fmt: (v: number) => v.toFixed(1) + "%", higherIsBetter: false },
                            { label: "Board Control (VC seats)", key: "vcSeats" as const, fmt: (v: number) => String(v), higherIsBetter: false },
                            { label: "Pref Overhang", key: "totalPref" as const, fmt: (v: number) => fmtM(v), higherIsBetter: false },
                            { label: "Founder take-home @$50M", key: "founderPayout50" as const, fmt: (v: number) => fmtM(v), higherIsBetter: true },
                            { label: "Founder take-home @$100M", key: "founderPayout100" as const, fmt: (v: number) => fmtM(v), higherIsBetter: true },
                            { label: "Founder take-home @$200M", key: "founderPayout200" as const, fmt: (v: number) => fmtM(v), higherIsBetter: true },
                          ];

                          return rows.map((r) => {
                            const best = r.higherIsBetter ? maxOf(r.key) : minOf(r.key);
                            const worst = r.higherIsBetter ? minOf(r.key) : maxOf(r.key);
                            return (
                              <tr key={r.label} className="border-b last:border-0">
                                <td className="py-2 pr-3 font-semibold">{r.label}</td>
                                {cols.map((c) => {
                                  const val = Number(c[r.key] as number);
                                  return (
                                    <td key={c.name + r.label} className={cn("py-2 px-2 text-right", cellCls(val, best, worst, r.higherIsBetter))}>
                                      {r.fmt(val)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── EXIT ── */}
        <TabsContent value="exit" className="space-y-3 mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs font-semibold">Exit Valuation: {fmtM(state.exitValue)}</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    <p className="font-bold text-primary mb-1">Exit Valuation</p>
                    <p>The acquisition or IPO price you're modelling. Drag to see how founder payouts change at different exit sizes.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Apply liquidation preferences</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">
                      <p className="font-bold text-primary mb-1">Liquidation Preferences</p>
                      <p>Toggle on to see realistic founder take-home after VCs are paid first. Toggle off to see naive pro-rata split.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
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
                  <RechartsTooltip formatter={(v: number) => fmtM(v)} />
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
