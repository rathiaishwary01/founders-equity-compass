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
  vestedFraction,
  fmtM,
  fmtVal,
  latestSnap,
} from "@/lib/equity/calc";
import {
  DEFAULT_STATE,
  DEFAULT_VESTING,
  HOLDER_COLORS,
  INDIA_DEFAULT_ROUNDS,
  INITIAL_HOLDERS,
  ROUND_BENCHMARK_NOTES,
  ROUND_BENCHMARKS,
  ROUND_ICONS,
  ROUND_KEYS,
  ROUND_LABELS,
  US_DEFAULT_ROUNDS,
  US_ROUND_BENCHMARKS,
  type RoundConfig,
  type RoundKey,
  type SimulatorState,
  type VestingConfig,
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

const EXTRA_FOUNDER_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4"];

interface Props {
  state: SimulatorState;
  onChange: (next: SimulatorState) => void;
  readOnly?: boolean;
}


export function Simulator({ state, onChange, readOnly = false }: Props) {
  const snaps = useMemo(() => computeSnaps(state), [state]);
  const snapKeys = Object.keys(snaps);
  const latest = latestSnap(snaps);
  const [capRound, setCapRound] = useState<string>("pre");
  const activeCap = snaps[capRound] ?? latest;
  const [expertMode, setExpertMode] = useState(false);
  const [activeTab, setActiveTab] = useState("setup");
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

  const updateVesting = (name: string, patch: Partial<VestingConfig>) => {
    if (readOnly) return;
    const current = state.vesting?.[name] ?? DEFAULT_VESTING;
    onChange({ ...state, vesting: { ...state.vesting, [name]: { ...current, ...patch } } });
  };

  // Pre-funding cap table (custom or default)
  const founders = state.founders ?? INITIAL_HOLDERS;
  const founderOnlyHolders = founders.filter((h) => h.type === "founder");

  const updateFounderField = (idx: number, patch: Partial<{ name: string; role: string; pct: number }>) => {
    if (readOnly) return;
    const next = founders.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    onChange({ ...state, founders: next });
  };

  const addFounder = () => {
    if (readOnly) return;
    const taken = founders.reduce((s, h) => s + h.pct, 0);
    const remaining = Math.max(0, parseFloat((100 - taken).toFixed(1)));
    // Insert before ESOP/Advisory rows
    const insertAt = founders.findIndex((h) => h.type === "esop");
    const newHolder = { name: "New Founder", role: "Co-founder", pct: remaining, type: "founder" as const };
    const next = insertAt >= 0
      ? [...founders.slice(0, insertAt), newHolder, ...founders.slice(insertAt)]
      : [...founders, newHolder];
    onChange({ ...state, founders: next });
  };

  const removeFounder = (idx: number) => {
    if (readOnly) return;
    onChange({ ...state, founders: founders.filter((_, i) => i !== idx) });
  };

  const founderSum = founders.reduce((s, h) => s + h.pct, 0);
  const founderSumOk = Math.abs(founderSum - 100) < 0.11;

  const founderPct = latest.holders.filter((h) => h.type === "founder").reduce((s, h) => s + h.pct, 0);
  // Include SAFE investors — they hold converted equity just like VC investors
  const vcPct = latest.holders.filter((h) => h.type === "vc" || h.type === "safe").reduce((s, h) => s + h.pct, 0);

  // Founder seats from state (BUG FIX 3)
  const founderSeats = state.founderSeats;
  const totalSeats = founderSeats + 1 + latest.vcSeats;
  const fSeatPct = Math.round((founderSeats / totalSeats) * 100);
  const vSeatPct = Math.round((latest.vcSeats / totalSeats) * 100);
  const iSeatPct = 100 - fSeatPct - vSeatPct;

  const fPayouts = founderPayouts(
    latest,
    state.exitValue,
    state.usePref,
    state.vestingEnabled ?? false,
    state.vesting ?? {},
    state.accelerationAtExit ?? true,
  );
  const founderTotal = fPayouts.reduce((s, f) => s + f.payout, 0);
  const totalPref = (latest.roundData || []).filter((r) => r.type === "vc").reduce((s, r) => s + r.investment * r.prefMult, 0);
  const totalInvested = (latest.roundData || []).filter((r) => r.type === "vc").reduce((s, r) => s + r.investment, 0);
  const allPayouts = calcPayouts(latest, state.exitValue, state.usePref);
  const vcTotal = latest.holders.filter((h) => h.type === "vc" || h.type === "safe").reduce((s, h) => s + (allPayouts[h.name] || 0), 0);

  // ── Input validation ──
  const validationErrors = useMemo(() => {
    const errs: Record<string, string> = {};

    // SAFE validation
    if (state.safe.enabled) {
      if (state.safe.amount <= 0) errs["safe-amount"] = "Amount must be greater than 0";
      if (!state.safe.mfn) {
        if (state.safe.cap <= 0) errs["safe-cap"] = "Valuation cap must be greater than 0";
        if (state.safe.cap < state.safe.amount) errs["safe-cap"] = "Cap should be larger than the SAFE amount";
        if (state.safe.discount < 0 || state.safe.discount > 50) errs["safe-discount"] = "Discount must be between 0% and 50%";
      }
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

  const isUS = state.market === "us";

  const riskSignals = useMemo(() => {
    const signals: Array<{ tone: "red" | "orange" | "yellow" | "green"; text: string }> = [];

    // Signal 1 — Board control
    if (latest.vcSeats >= founderSeats) {
      signals.push({
        tone: "red",
        text: isUS
          ? `VCs hold ${latest.vcSeats} board seats — under DGCL, the board controls CEO hiring/firing, M&A approval, and company strategy`
          : `VCs hold ${latest.vcSeats} board seats — independent director decides all key votes`,
      });
    } else {
      signals.push({
        tone: "green",
        text: isUS
          ? `Founder-controlled board: ${founderSeats} vs ${latest.vcSeats} VC seats — protected under your Delaware SHA`
          : `Founder-controlled board: ${founderSeats} vs ${latest.vcSeats} VC seats`,
      });
    }

    // Signal 2 — Equity threshold (statutory in India, contractual in US)
    if (isUS) {
      if (founderPct < 30) {
        signals.push({
          tone: "red",
          text: `Founders at ${founderPct.toFixed(1)}% — US VCs rely on contractual protective provisions, not statutory thresholds. At this level, most exit decisions require investor approval.`,
        });
      } else if (founderPct < 50) {
        signals.push({
          tone: "orange",
          text: `Founders at ${founderPct.toFixed(1)}% — lost simple majority. US term sheets grant VCs veto rights over M&A, new share classes, and charter amendments regardless of %.`,
        });
      }
    } else {
      if (founderPct < 26) {
        signals.push({ tone: "red", text: `Founders at ${founderPct.toFixed(1)}% — below 26%, VCs can block ALL major decisions under Companies Act 2013` });
      } else if (founderPct < 51) {
        signals.push({ tone: "orange", text: `Founders at ${founderPct.toFixed(1)}% — lost simple majority` });
      } else if (founderPct < 75) {
        signals.push({ tone: "yellow", text: `Founders at ${founderPct.toFixed(1)}% — VCs have special resolution blocking power (75% threshold)` });
      }
    }

    // Signal 3 — VC combined stake
    if (vcPct > 50) {
      signals.push({ tone: "red", text: `VCs combined at ${vcPct.toFixed(1)}% — can override founders on ordinary resolutions` });
    } else if (vcPct > 26) {
      signals.push({
        tone: "orange",
        text: isUS
          ? `VCs at ${vcPct.toFixed(1)}% — protective provisions give veto over M&A, new share issuances, and certificate of incorporation amendments`
          : `VCs at ${vcPct.toFixed(1)}% — can veto M&A, SHA changes, new share issuances`,
      });
    }

    // Signal 4 — Preference overhang
    if (totalPref > 0) {
      const overhangRatio = state.exitValue > 0 ? totalPref / state.exitValue : 0;
      const tone = overhangRatio > 0.5 ? "red" : overhangRatio > 0.25 ? "orange" : "yellow";
      signals.push({ tone, text: `${fmtM(totalPref)} liquidation overhang — founders receive $0 in any exit below this amount` });
    }

    // Signal 5 — Participating preferred
    if (hasParticipatingPreferred) {
      signals.push({
        tone: "orange",
        text: `Participating preferred in ${participatingRoundNames} — VCs collect preference then also participate in remaining proceeds`,
      });
    }

    // US-specific signals
    if (isUS) {
      signals.push({
        tone: "yellow",
        text: "If currently incorporated in India: most US institutional VCs (YC, Sequoia US, a16z) require a Delaware C-Corp flip before closing. If already a Delaware entity, this does not apply.",
      });
      if (state.safe.enabled) {
        signals.push({
          tone: "yellow",
          text: "YC post-money SAFE: investor dilution is fixed at SAFE ÷ cap. All future dilution (ESOP top-ups, bridge rounds) falls entirely on founders until conversion.",
        });
      }
    } else {
      // India-specific: FEMA / foreign investment signal if any VC rounds
      if (anyRoundsEnabled) {
        signals.push({
          tone: "yellow",
          text: "If any investor is foreign-domiciled (US, Singapore, Cayman, etc.): FEMA compliance required — FC-GPR filing within 30 days and FMV pricing per SEBI norms. Indian VC investment does not require FC-GPR.",
        });
      }
    }

    return signals.slice(0, 6);
  }, [
    isUS,
    latest.vcSeats,
    founderSeats,
    founderPct,
    vcPct,
    totalPref,
    state.exitValue,
    hasParticipatingPreferred,
    participatingRoundNames,
    state.safe.enabled,
    anyRoundsEnabled,
  ]);

  const recommendations = useMemo(() => {
    type Timing = "now" | "next-round" | "ongoing";
    type Priority = "critical" | "high" | "medium";
    interface Rec {
      priority: Priority;
      timing: Timing;
      action: string;
      why: string;
      nextStep: string;
      leverage?: string;
    }
    const recs: Rec[] = [];
    const vcSeats = latest.vcSeats;

    // ── Board control lost ───────────────────────────────────────────────────
    if (vcSeats >= founderSeats + 1) {
      recs.push({
        priority: "critical",
        timing: "now",
        action: `Reclaim board balance — VCs hold ${vcSeats} seats, you hold ${founderSeats}`,
        why: isUS
          ? `Under DGCL the board controls CEO removal, M&A approval, and new equity issuances. With ${vcSeats} VC seats vs your ${founderSeats}, every major decision can be forced through without you.`
          : `With ${vcSeats} VC seats vs your ${founderSeats} founder seats, VCs can remove the CEO, block any acquisition, and issue new shares that dilute you further — all without your vote.`,
        nextStep: isUS
          ? "Add to your next SHA negotiation: (1) founders nominate the independent director, (2) supermajority board consent (≥75%) required for CEO removal, (3) cap all future rounds at 1 observer seat only."
          : "Add to your next SHA negotiation: (1) founders have the right to nominate the independent director, (2) unanimous board consent required for CEO removal, (3) future rounds get observer seats only — no new director rights.",
        leverage: "Use competing term sheets or a down-round scenario to reopen governance terms.",
      });
    }

    // ── Board tied ───────────────────────────────────────────────────────────
    if (vcSeats === founderSeats && vcSeats > 0) {
      recs.push({
        priority: "high",
        timing: "now",
        action: `Board is ${founderSeats}–${vcSeats} tied — the independent director is the swing vote on everything`,
        why: "A tied board means every contested decision — CEO comp, M&A, next round terms — is decided by whoever the independent director sides with. Most independents are former VCs or VC-network operators.",
        nextStep: isUS
          ? "Draft SHA clause this week: 'Founders shall have the right to nominate the independent director, subject to VC approval not to be unreasonably withheld.' Add a conflict-of-interest bar: the independent must not be a GP or LP in any fund on the board."
          : "Draft SHA clause: 'Founders shall have the right to nominate the independent director.' Bar: independent must not be an LP in any fund represented on the board.",
        leverage: "Raise this before the next round term sheet — it's easiest to fix when investors want the deal.",
      });
    }

    // ── Dual-class shares ────────────────────────────────────────────────────
    if (anyRoundsEnabled) {
      recs.push({
        priority: founderPct < 51 ? "high" : "medium",
        timing: "now",
        action: isUS
          ? "Set up dual-class shares (10:1 voting) in Delaware — must be done before first priced round closes"
          : "Set up dual-class shares (DVR, 10:1 voting) — must be done before first round closes",
        why: isUS
          ? `Your founders are at ${founderPct.toFixed(1)}% equity. With dual-class, even at 15% equity you keep majority votes. Google, Meta, and Snap all use this structure. Once VCs invest, adding it requires unanimous shareholder consent — they will almost always say no.`
          : `Your founders are at ${founderPct.toFixed(1)}% equity. With DVR shares (Class B, 10 votes each) under Companies Act Section 43, even at 20% equity you retain 70%+ of votes. After VCs invest, this requires unanimous consent — practically impossible.`,
        nextStep: isUS
          ? "Call a Delaware startup attorney this week. Ask for a dual-class recapitalisation: founders get Class B (10 votes), investors get Class A (1 vote). Cost: $5–15K. Timeline: 2–4 weeks. Do this before any term sheet is signed."
          : "Engage a CA/CS this week. Ask for DVR share issuance under Section 43 before the first round SPA is signed. Cost: ₹50K–₹2L. Must be approved by shareholders and ROC-filed before allotment.",
      });
    }

    // ── Board seat cap ───────────────────────────────────────────────────────
    if (anyRoundsEnabled && vcSeats >= 1 && vcSeats < founderSeats + 1) {
      recs.push({
        priority: "high",
        timing: "next-round",
        action: "Lock in a hard cap: all VCs combined ≤ 2 board seats, forever",
        why: `You currently have ${vcSeats} VC seat${vcSeats > 1 ? "s" : ""}. Without a cap, every future lead investor will demand a seat — you'll lose board control by Series B without a single bad decision.`,
        nextStep: isUS
          ? "Insist on this IRA / SHA clause before the next term sheet is signed: 'All Investor Directors combined shall not exceed two (2) seats at any time, regardless of future financing rounds.' Delaware courts will enforce it."
          : "Insist on this SHA clause: 'All investor directors combined shall not exceed two (2) seats at any time, regardless of future financings.' Have your lawyer add it to the SHA as a condition to closing.",
        leverage: "Offer a broader information rights package (quarterly updates, board observer access) in exchange for the seat cap.",
      });
    }

    // ── Series A 2-seat risk ─────────────────────────────────────────────────
    if (state.rounds.a.enabled && state.rounds.a.board === "2") {
      recs.push({
        priority: "high",
        timing: "next-round",
        action: "Negotiate Series A VC board from 2 seats down to 1",
        why: "2 VC seats at Series A + 1 at Series B = tied board. The independent director becomes kingmaker from Series B onward and you have no control over who that is.",
        nextStep: "Counter the term sheet with 1 seat + 1 observer for the Series A lead. Offer enhanced information rights (monthly financials, budget approval visibility) as the trade. Most institutional VCs will accept if you ask early.",
        leverage: "2 VC seats is not market standard at Series A in the US or India — use NVCA or YC safe harbour language to anchor the negotiation.",
      });
    }

    // ── Participating preferred ──────────────────────────────────────────────
    if (hasParticipatingPreferred) {
      const fPayoutsBase = founderPayouts(latest, state.exitValue, false, false, {}, true);
      const fPayoutsPref = founderPayouts(latest, state.exitValue, true, false, {}, true);
      const baseTake = fPayoutsBase.reduce((s, f) => s + f.payout, 0);
      const prefTake = fPayoutsPref.reduce((s, f) => s + f.payout, 0);
      const lostM = baseTake - prefTake;
      recs.push({
        priority: "critical",
        timing: "next-round",
        action: "Strike participating preferred from every round — negotiate non-participating 1×",
        why: `At a ${fmtM(state.exitValue)} exit, participating preferred costs founders ${fmtM(lostM)} compared to non-participating — VCs get their capital back AND share the upside. This is the single most value-destructive term after board control.`,
        nextStep: isUS
          ? "Counter every term sheet with: 'Non-participating preferred, 1× liquidation preference.' Cite NVCA Model Documents — participating preferred is rare post-2015 in US institutional rounds. Walk away from any deal that won't move off participating."
          : "Cite the India market standard: non-participating at Seed, Series A, and beyond. Add to your SHA: 'Preference shares shall be non-participating. Investors elect either preference OR pro-rata common — not both.'",
        leverage: `${fmtM(lostM)} is a concrete number to put in front of a VC — show them the exit waterfall. Most reasonable investors will concede once they see the founder outcome.`,
      });
    }

    // ── 2× preference ───────────────────────────────────────────────────────
    const hasAggressivePref = enabledRounds.some((k) => state.rounds[k].prefMult >= 2);
    if (hasAggressivePref) {
      const aggressiveRounds = enabledRounds.filter((k) => state.rounds[k].prefMult >= 2).map((k) => ({ seed: "Seed", preseed: "Pre-seed", a: "Series A", b: "Series B", c: "Series C" }[k]));
      recs.push({
        priority: "critical",
        timing: "next-round",
        action: `Push back on 2× liquidation preference in ${aggressiveRounds.join(", ")}`,
        why: `A 2× preference means investors get double their money back before founders see anything. If your exit is smaller than expected, founders walk away with nothing while VCs are made whole twice over. 1× non-participating is the global market standard.`,
        nextStep: "Respond to the term sheet with: 'We'll accept 1× non-participating, standard market terms. We have another conversation ongoing and will move to whichever investor matches market.' Then actually run a competitive process — a single competing term sheet drops 2× to 1× in most cases.",
        leverage: "Use Carta / Visible term sheet benchmarks to show 2× is an outlier — data wins this argument.",
      });
    }

    // ── US-specific ──────────────────────────────────────────────────────────
    if (isUS) {
      recs.push({
        priority: "high",
        timing: "now",
        action: "If incorporated in India: flip to a Delaware C-Corp before your first US term sheet",
        why: "Most US institutional investors (YC, Sequoia, a16z, General Catalyst) legally cannot invest in Indian entities due to fund LP restrictions. They will pass on your deal — not because they don't like you, but because their fund documents prohibit it.",
        nextStep: "Engage Gunderson Dettmer, Cooley, or Wilson Sonsini this week. Ask for a 'redomiciliation flip' quote — Indian entity becomes a wholly-owned US subsidiary. Budget $30–50K legal, 60–90 days. Start before any term sheet so you don't lose a deal to timeline.",
        leverage: "If you already have a Delaware entity, this does not apply — skip it.",
      });
      if (!state.safe.enabled) {
        recs.push({
          priority: "medium",
          timing: "now",
          action: "For angel / pre-seed rounds: use YC's post-money SAFE — avoid bespoke SAFE terms",
          why: "Custom SAFEs often have ambiguous conversion mechanics and side letters that create hidden pro-rata obligations. Post-money SAFE fixes investor dilution at the cap; all ESOP top-up dilution falls on founders until conversion.",
          nextStep: "Download the YC SAFE from ycombinator.com/documents. Use the post-money version with a valuation cap. Add MFN for your first cheque. Decline any requests for side letters with additional information rights or pro-rata beyond what the SAFE provides.",
        });
      }
      const hasEsopRounds = enabledRounds.some((k) => state.rounds[k].esop > 0);
      if (hasEsopRounds) {
        recs.push({
          priority: "high",
          timing: "ongoing",
          action: "Get a 409A valuation within 12 months of every ESOP grant — and refresh after each round",
          why: "Without a 409A, the IRS classifies all options as NSOs. A senior engineer with 100K ISOs at a $200M exit loses ~$40K in tax treatment vs NSOs. You'll fail to attract top talent if your option plan isn't defensible.",
          nextStep: "After this round closes, order a 409A from Carta, Capshare, or a Big 4 team ($5–15K). Put a recurring calendar reminder: refresh 409A annually and within 90 days of any material financing event. ISOs go to US employees; use NSOs for international hires.",
        });
      }
    } else {
      // ── India-specific ───────────────────────────────────────────────────
      recs.push({
        priority: "high",
        timing: "now",
        action: "Confirm investor domicile before allotment — your compliance path is completely different",
        why: "Indian VC (SEBI-registered AIF): standard board resolution + ROC filing, no RBI loop needed. Foreign VC (US, Singapore, Cayman): FEMA applies — FC-GPR mandatory within 30 days, pricing must be at or above FMV, funds must route through an authorised dealer bank.",
        nextStep: "Before signing any SPA: (1) ask the VC for their SEBI AIF registration number OR confirm their legal domicile, (2) if foreign — appoint an AD bank (HDFC, ICICI, or Kotak) to receive funds, (3) get a CA/CS to handle the allotment and FC-GPR filing. Price shares using SEBI DCF/NAV norms and get a valuation certificate before allotment.",
        leverage: "For Indian AIFs investing via GIFT City or offshore structures: domicile classification is not always obvious. Have your lawyer confirm before signing.",
      });
      const hasEarlyRounds = state.rounds.preseed.enabled || state.rounds.seed.enabled;
      if (hasEarlyRounds) {
        recs.push({
          priority: "medium",
          timing: "now",
          action: "Consider CCDs instead of direct equity for pre-seed and seed rounds",
          why: "Direct equity at early stages triggers FMV valuation requirements immediately. CCDs defer the FMV question until conversion — cleaner for sub-₹5Cr cheques and avoids a potentially ugly early valuation fight.",
          nextStep: "Ask your CA to structure the instrument as CCDs with: (1) 6–10% interest rate (arm's length), (2) mandatory conversion trigger at the next priced equity round, (3) conversion ratio set at a discount to that round's pre-money price. Avoid SAFEs for Indian entities — RBI has not provided clear FEMA guidance for them.",
        });
      }
    }

    // ── Founder Voting Agreement ─────────────────────────────────────────────
    if (anyRoundsEnabled) {
      const latestFounderHolders = latest.holders.filter((h) => h.type === "founder");
      const anyFounderBelowFloor = latestFounderHolders.some((h) => h.pct < 5);
      recs.push({
        priority: anyFounderBelowFloor ? "critical" : "high",
        timing: "now",
        action: anyFounderBelowFloor
          ? "Sign a Founder Voting Agreement immediately — at least one founder is below the 5% individual nomination floor"
          : "Sign a Founder Voting Agreement before your first institutional round",
        why: anyFounderBelowFloor
          ? `One or more founders now hold less than 5% individually. VCs can challenge their right to self-nominate as directors. Without a Voting Agreement, those founders can be removed from the board by a shareholder vote they can't win alone.`
          : `With ${founderOnlyHolders.length} founders, equity dilutes unevenly round by round. Founders with smaller initial stakes hit the 5% individual nomination floor earlier than others. A Voting Agreement locks in 2 founder board seats regardless of who gets diluted first — costs nothing to negotiate today, nearly impossible to add after Series A.`,
        nextStep: isUS
          ? "Have your lawyer draft a Voting Agreement this week (3–5 pages): all founders pledge to vote their shares to elect each other as directors. Must cover: (1) all current and future share classes, (2) survives any ROFR transfers, (3) terminates only on mutual written consent or qualified IPO. Sign before any term sheet is received."
          : "Have your lawyer prepare a Voting Agreement side letter this week: all founders agree to vote their shares to elect each other as directors. Clauses: (1) applies to all current and future equity classes, (2) survives secondary transfers between founders, (3) new co-founders may be added by unanimous consent. Sign before any VC term sheet.",
        leverage: isUS
          ? "VCs will try to block or dilute this clause at Series A — sign it now before any term sheet is in play. Pre-Series A founders have full leverage to sign among themselves."
          : "Easiest to sign now — after Seed round, VCs will require SHA consent for any new founder-side agreements and may object to bloc-voting clauses.",
      });
    }

    return recs;
  }, [isUS, latest, founderSeats, founderPct, founderOnlyHolders, anyRoundsEnabled, state.rounds, state.exitValue, state.usePref, enabledRounds, hasParticipatingPreferred, state.safe.enabled]);

  // Line chart data with dynamic Y max (BUG FIX 2)
  const lineData = snapKeys.map((k) => {
    const row: Record<string, number | string> = { round: snaps[k].label };
    founderOnlyHolders.forEach((f) => {
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
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total Investor Stake</div>
          <div className="text-2xl font-extrabold mt-1">{vcPct.toFixed(1)}%</div>
          <div className="text-[11px] text-muted-foreground">
            {(() => {
              const names = [...latest.vcNames];
              if (latest.holders.some((h) => h.type === "safe")) names.unshift("SAFE");
              return names.length ? names.join(", ") : "No rounds yet";
            })()}
          </div>
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
              setActiveTab("captable");
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
            <TabsTrigger value="setup" className="flex-shrink-0 text-xs px-3 py-2">👥 Setup</TabsTrigger>
            <TabsTrigger value="rounds" className="flex-shrink-0 text-xs px-3 py-2">⚙️ Rounds</TabsTrigger>
            <TabsTrigger value="captable" className="flex-shrink-0 text-xs px-3 py-2">📋 Cap Table & Board</TabsTrigger>
            <TabsTrigger value="veto" className={cn("flex-shrink-0 text-xs px-3 py-2", !expertMode && "opacity-30 pointer-events-none")}>🛡️ Veto</TabsTrigger>
            <TabsTrigger value="protect" className={cn("flex-shrink-0 text-xs px-3 py-2", !expertMode && "opacity-30 pointer-events-none")}>🔒 Protect</TabsTrigger>
            <TabsTrigger value="exit" className="flex-shrink-0 text-xs px-3 py-2">💰 Exit</TabsTrigger>
            <TabsTrigger value="compare" className="flex-shrink-0 text-xs px-3 py-2">📊 Compare</TabsTrigger>
          </TabsList>
        </div>

        {/* ── SETUP ── */}
        <TabsContent value="setup" className="space-y-3 mt-4">

          {/* Market toggle */}
          <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
            <button
              disabled={readOnly}
              onClick={() => {
                if (readOnly || state.market === "india") return;
                const noRoundsActive = ROUND_KEYS.every((k) => !state.rounds[k].enabled);
                onChange({
                  ...state,
                  market: "india",
                  rounds: noRoundsActive ? INDIA_DEFAULT_ROUNDS : state.rounds,
                });
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all",
                state.market !== "us"
                  ? "bg-white shadow text-foreground dark:bg-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              🇮🇳 India
            </button>
            <button
              disabled={readOnly}
              onClick={() => {
                if (readOnly || state.market === "us") return;
                const noRoundsActive = ROUND_KEYS.every((k) => !state.rounds[k].enabled);
                onChange({
                  ...state,
                  market: "us",
                  rounds: noRoundsActive ? US_DEFAULT_ROUNDS : state.rounds,
                });
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all",
                state.market === "us"
                  ? "bg-white shadow text-foreground dark:bg-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              🇺🇸 United States
            </button>
          </div>

          {/* US context banner */}
          {isUS && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              <span className="font-bold">US mode</span> — Round sizes default to US norms ($M). Insights reflect Delaware C-Corp structure, YC SAFE terms, 409A requirements, and NVCA protective provisions.
            </div>
          )}

          {/* Founder seats */}
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
                    <p>How many board seats founders control. This flows into board control, voting power, and "safe / tied / lost" recommendations across rounds.</p>
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

          {/* Board retention equity threshold */}
          <Card className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs font-semibold">Min. founder equity to retain board seats</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-xs">
                    <p className="font-bold text-primary mb-1">Board Retention Threshold</p>
                    <p>Most VC term sheets include a "Director Qualification Threshold" clause: if founders collectively dilute below this equity %, the SHA requires them to resign their director seats. {isUS ? "US standard: 10–15% (NVCA model)." : "India standard: 15–20% (standard SEBI / Blume-era SHA language)."}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              If founders collectively drop below this threshold, your SHA typically requires immediate resignation of all founder-nominated director seats.
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={49}
                step={1}
                disabled={readOnly}
                value={state.boardRetentionPct ?? (isUS ? 10 : 15)}
                className="w-24 h-8 text-sm"
                onChange={(e) => {
                  const v = Math.max(0, Math.min(49, Number(e.target.value)));
                  onChange({ ...state, boardRetentionPct: v });
                }}
              />
              <span className="text-sm font-semibold">%</span>
              <span className="text-xs text-muted-foreground">collective founder equity (fully diluted)</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              {isUS ? "💡 US default: 10% — Delaware / NVCA standard. Negotiate to 5% before signing." : "💡 India default: 15% — typical in SHA from Seed onward. Push to 10% and exclude VC-dilution rounds."}
            </div>
          </Card>

          {/* Pre-funding Cap Table Editor */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-sm">👥 Pre-funding Cap Table</div>
              <div className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full",
                founderSumOk ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-600",
              )}>
                {founderSum.toFixed(1)}% {founderSumOk ? "✓" : "≠ 100%"}
              </div>
            </div>
            <table className="w-full text-xs mb-3">
              <thead>
                <tr className="text-[10px] uppercase text-muted-foreground border-b">
                  <th className="text-left py-1.5 pr-2">Name</th>
                  <th className="text-left py-1.5 pr-2">Role</th>
                  <th className="text-right py-1.5 pr-2 w-20">Equity %</th>
                  {!readOnly && <th className="w-6" />}
                </tr>
              </thead>
              <tbody>
                {founders.map((h, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-1 pr-2">
                      {h.type === "esop" || h.type === "advisory" ? (
                        <span className="font-semibold text-muted-foreground">{h.name}</span>
                      ) : (
                        <Input
                          value={h.name}
                          disabled={readOnly}
                          className="h-7 text-xs px-2"
                          onChange={(e) => updateFounderField(idx, { name: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {h.type === "esop" || h.type === "advisory" ? (
                        <span className="text-muted-foreground">{h.role}</span>
                      ) : (
                        <Input
                          value={h.role}
                          disabled={readOnly}
                          className="h-7 text-xs px-2"
                          onChange={(e) => updateFounderField(idx, { role: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="py-1 pr-2 w-20">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={h.pct}
                        disabled={readOnly}
                        className="h-7 text-xs px-2 text-right"
                        onChange={(e) => updateFounderField(idx, { pct: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    {!readOnly && (
                      <td className="py-1 text-center">
                        {h.type === "founder" && (
                          <button
                            onClick={() => removeFounder(idx)}
                            className="w-5 h-5 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 flex items-center justify-center text-sm font-bold transition-colors"
                            title="Remove founder"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={addFounder}
                  className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  + Add Founder
                </button>
                {state.founders && (
                  <button
                    onClick={() => onChange({ ...state, founders: undefined })}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Reset to defaults
                  </button>
                )}
              </div>
            )}
            {!founderSumOk && (
              <p className="text-[10px] text-red-500 mt-2">
                Equity must sum to exactly 100%. Current total: {founderSum.toFixed(1)}%.
              </p>
            )}
          </Card>

          {/* SAFE / Convertible Note */}
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
                  {isUS
                    ? "YC post-money SAFE: converts at your first priced round. Use MFN (no cap) to model YC's $375K SAFE — it converts at the same price as your Seed investors."
                    : "SAFEs convert to equity at your first priced round. In India, CCDs (Compulsorily Convertible Debentures) are the more common equivalent for RBI compliance."}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <div className="text-xs font-semibold">MFN / No cap (YC standard)</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Converts at the next round's pre-money price — same as other investors. No cap, no discount.</div>
                  </div>
                  <Switch
                    checked={state.safe.mfn ?? false}
                    disabled={readOnly}
                    onCheckedChange={(v) => updateSafe("mfn", v)}
                  />
                </div>

                {isUS && (
                  <button
                    disabled={readOnly}
                    onClick={() => {
                      if (readOnly) return;
                      onChange({
                        ...state,
                        safe: { ...state.safe, enabled: true, amount: 0.375, mfn: true, cap: 0, discount: 0 },
                      });
                    }}
                    className="w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    ⚡ Fill YC $375K MFN SAFE
                  </button>
                )}

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

                  {!state.safe.mfn && <>
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
                  </>}
                </div>

                {state.safe.mfn && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-[10px] text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200">
                    MFN SAFE converts at the next priced round's pre-money valuation — no cap, no discount. This matches the YC $375K standard SAFE.
                  </div>
                )}
              </div>
            )}
          </Card>}

          {/* Vesting Schedule Config */}
          {expertMode && (
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">⏱️</span>
                <div className="font-bold flex-1">Founder Vesting Schedules</div>
                <Switch
                  checked={state.vestingEnabled ?? false}
                  disabled={readOnly}
                  onCheckedChange={(v) => onChange({ ...state, vestingEnabled: v })}
                />
              </div>

              {(state.vestingEnabled) && (
                <div className="space-y-4">
                  <div className="text-xs bg-muted rounded-md px-3 py-2 text-muted-foreground">
                    Standard 4-year cliff-then-linear vesting. Elapsed months tracks how much has already vested.
                    Single-trigger acceleration fully vests founders at acquisition.
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <div className="text-xs font-semibold">Single-trigger acceleration at exit</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        All unvested equity vests immediately on acquisition. Market standard — always negotiate for it.
                      </div>
                    </div>
                    <Switch
                      checked={state.accelerationAtExit ?? true}
                      disabled={readOnly}
                      onCheckedChange={(v) => onChange({ ...state, accelerationAtExit: v })}
                    />
                  </div>

                  {founderOnlyHolders.map((f) => {
                    const v = state.vesting?.[f.name] ?? DEFAULT_VESTING;
                    const vFrac = v.elapsedMonths < v.cliffMonths ? 0 : Math.min(1, v.elapsedMonths / v.vestMonths);
                    return (
                      <div key={f.name} className="rounded-lg border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold">{f.name}</div>
                            <div className="text-[10px] text-muted-foreground">{f.role}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold" style={{ color: HOLDER_COLORS[f.name] }}>
                              {(vFrac * 100).toFixed(0)}% vested
                            </div>
                            {v.elapsedMonths < v.cliffMonths && (
                              <div className="text-[10px] text-muted-foreground">Cliff not reached</div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">Cliff (mo.)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={24}
                              value={v.cliffMonths}
                              disabled={readOnly}
                              onChange={(e) => updateVesting(f.name, { cliffMonths: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">Total (mo.)</Label>
                            <Input
                              type="number"
                              min={12}
                              max={72}
                              value={v.vestMonths}
                              disabled={readOnly}
                              onChange={(e) => updateVesting(f.name, { vestMonths: parseInt(e.target.value) || 48 })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">Elapsed (mo.)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={v.vestMonths}
                              value={v.elapsedMonths}
                              disabled={readOnly}
                              onChange={(e) => updateVesting(f.name, { elapsedMonths: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: (vFrac * 100) + "%" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* CTA nudge to configure rounds */}
          <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground text-center">
            Setup complete? Head to <button className="font-semibold text-primary underline-offset-2 underline" onClick={() => setActiveTab("rounds")}>⚙️ Rounds</button> to model your funding path.
          </div>

        </TabsContent>

        {/* ── ROUNDS ── */}
        <TabsContent value="rounds" className="space-y-3 mt-4">

          {/* Market badge — read-only indicator, click goes to Setup */}
          <button
            onClick={() => setActiveTab("setup")}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors w-full"
          >
            <span>{isUS ? "🇺🇸" : "🇮🇳"}</span>
            <span>{isUS ? "United States" : "India"} mode</span>
            <span className="ml-auto text-muted-foreground">← change in Setup</span>
          </button>

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

          {ROUND_KEYS.map((k) => {
            const r = state.rounds[k];
            if (!r) return null;
            const dil = r.preMoney && r.raise ? (r.raise / (r.preMoney + r.raise)) * 100 : 0;
            const bench = (isUS ? US_ROUND_BENCHMARKS : ROUND_BENCHMARKS)[k];
            const benchNote = ROUND_BENCHMARK_NOTES[isUS ? "us" : "india"][k];
            const dilCls = dil === 0 ? "text-muted-foreground" : dil <= bench.hi ? "text-success" : dil <= bench.hi + 5 ? "text-warning" : "text-danger";
            const isPreSeed = k === "preseed";
            return (
              <Card key={k} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{ROUND_ICONS[k]}</span>
                  <div className="font-bold flex-1">{ROUND_LABELS[k]}</div>
                  {isPreSeed && isUS && !r.enabled && (
                    <button
                      disabled={readOnly}
                      onClick={() => {
                        if (readOnly) return;
                        // YC standard: $125K for 7% → pre-money $1.661M
                        updateRound(k, { enabled: true, preMoney: 1.661, raise: 0.125, esop: 0, board: "observer" });
                        // Also suggest enabling the MFN SAFE
                        if (!state.safe.enabled) {
                          onChange({
                            ...state,
                            rounds: { ...state.rounds, [k]: { ...state.rounds[k], enabled: true, preMoney: 1.661, raise: 0.125, esop: 0, board: "observer" } },
                            safe: { ...state.safe, enabled: true, amount: 0.375, mfn: true, cap: 0, discount: 0 },
                          });
                        }
                      }}
                      className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                    >
                      ⚡ YC Standard
                    </button>
                  )}
                  <Switch checked={r.enabled} disabled={readOnly} onCheckedChange={(v) => updateRound(k, { enabled: v })} />
                </div>
                {isPreSeed && r.enabled && (
                  <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[10px] text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
                    {isUS
                      ? "YC deal: $125K for 7% direct equity + $375K MFN SAFE (enable SAFE panel above). Pre-money auto-set to $1.661M so raise ÷ post = 7%."
                      : "Pre-seed equity round — typically angels, accelerators, or friends & family. No ESOP top-up required at this stage."}
                    {dil > 0 && <span className="ml-2 font-bold">Computed equity given: {dil.toFixed(1)}%</span>}
                  </div>
                )}
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
                      {expertMode && !isPreSeed && <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Anti-dilution</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">?</button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[240px] text-xs">
                                <p className="font-bold text-primary mb-1">Anti-dilution Protection</p>
                                <p className="mb-1">Protects this VC if a future round is raised at a lower valuation (down round).</p>
                                <p><span className="font-bold">BBWA</span> — Broad-Based Weighted Average. Market standard. Adjusts the VC's conversion price using a weighted average of old and new share prices. Founders lose more in a down round, but less than full ratchet.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Select
                          value={r.antiDilution ?? "none"}
                          disabled={readOnly}
                          onValueChange={(v) => updateRound(k, { antiDilution: v as "none" | "bbwa" })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="bbwa">BBWA (Standard)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>}
                    </div>
                    <div className="rounded-md bg-muted px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Dilution this round</span>
                        <span className={cn("font-bold", dilCls)}>
                          {dil.toFixed(1)}%{" "}
                          <span className="text-muted-foreground font-normal">({isUS ? "US" : "India"} norm: {bench.lo}–{bench.hi}%)</span>
                        </span>
                      </div>
                      {dil > 0 && <div className="mt-1 text-[10px] text-muted-foreground">{benchNote}</div>}
                    </div>
                    {/* Down-round warning — shown when this round's pre < previous post */}
                    {(() => {
                      const snap = snaps[k];
                      if (!snap?.isDownRound) return null;
                      const adRounds = ROUND_KEYS.filter((pk) => {
                        const pc = state.rounds[pk];
                        return pc?.enabled && pc.antiDilution === "bbwa" && pk !== k;
                      });
                      return (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                          <span className="font-bold">Down round — {snap.valDrop}% below previous post-money.</span>
                          {adRounds.length > 0
                            ? ` BBWA anti-dilution triggered for ${adRounds.map((pk) => ROUND_LABELS[pk]).join(", ")} investors — founders diluted further.`
                            : " No anti-dilution protection active for prior investors."}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </Card>
            );
          })}

          {/* SECTION B — Founder Playbook */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="font-bold text-sm">🧭 Founder Playbook</div>
              <Badge className="bg-primary/10 text-primary border border-primary/30">{recommendations.length} actions</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Personalised to your current scenario. Each action includes the exact next step to take.</p>
            {recommendations.length === 0 ? (
              <div className="text-sm text-muted-foreground">Enable funding rounds above to see your playbook.</div>
            ) : (
              (() => {
                const timingGroups: Array<{ key: "now" | "next-round" | "ongoing"; label: string; icon: string; borderColor: string; bgColor: string }> = [
                  { key: "now",        label: "Do Now",             icon: "🔴", borderColor: "border-red-300",    bgColor: "bg-red-50 dark:bg-red-950/30" },
                  { key: "next-round", label: "Before Next Round",  icon: "🟡", borderColor: "border-amber-300",  bgColor: "bg-amber-50 dark:bg-amber-950/30" },
                  { key: "ongoing",    label: "Ongoing",            icon: "🔵", borderColor: "border-blue-300",   bgColor: "bg-blue-50 dark:bg-blue-950/30" },
                ];
                const priorityBadge = (p: string) => {
                  if (p === "critical") return <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">Critical</span>;
                  if (p === "high")     return <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">High</span>;
                  return                       <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Medium</span>;
                };
                return (
                  <div className="space-y-5">
                    {timingGroups.map(({ key, label, icon, borderColor, bgColor }) => {
                      const group = recommendations.filter((r) => r.timing === key);
                      if (group.length === 0) return null;
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">{icon}</span>
                            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                          <div className="space-y-3">
                            {group.map((r, idx) => (
                              <div key={idx} className={cn("rounded-xl border p-3.5 space-y-2.5", borderColor, bgColor)}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-bold text-sm leading-snug flex-1">{r.action}</div>
                                  {priorityBadge(r.priority)}
                                </div>
                                <div className="text-xs text-foreground/80 leading-relaxed">{r.why}</div>
                                <div className={cn("rounded-lg p-2.5 border", key === "now" ? "bg-white/70 border-red-200 dark:bg-black/20 dark:border-red-800" : key === "next-round" ? "bg-white/70 border-amber-200 dark:bg-black/20 dark:border-amber-800" : "bg-white/70 border-blue-200 dark:bg-black/20 dark:border-blue-800")}>
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">→ Next Step</div>
                                  <div className="text-xs leading-relaxed">{r.nextStep}</div>
                                </div>
                                {r.leverage && (
                                  <div className="text-[11px] text-muted-foreground italic leading-relaxed">
                                    💡 <span className="font-semibold">Leverage: </span>{r.leverage}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
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
                  {founderOnlyHolders.map((f, i) => (
                    <Line key={f.name} type="monotone" dataKey={f.name} stroke={HOLDER_COLORS[f.name] || EXTRA_FOUNDER_COLORS[i % EXTRA_FOUNDER_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                  <Line type="monotone" dataKey="Total VC" stroke="#e74c3c" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ── Board Seat Runway ── */}
          {(() => {
            const twoSeatThreshold = isUS ? 20 : 25;
            const oneSeatThreshold = state.boardRetentionPct ?? (isUS ? 10 : 15);
            return (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-sm">🛤️ Board Seat Runway</div>
                  <div className="text-[10px] text-muted-foreground">≥{twoSeatThreshold}% = 2 seats · ≥{oneSeatThreshold}% = 1 seat · below = 0</div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">How many founder director seats you can defend at each stage, based on collective equity vs. your SHA thresholds.</p>
                <div className="flex items-end gap-4 flex-wrap">
                  {snapKeys.map((k) => {
                    const snap = snaps[k];
                    const fEq = snap.holders.filter((h) => h.type === "founder").reduce((s, h) => s + h.pct, 0);
                    const regime = fEq >= twoSeatThreshold ? "2" : fEq >= oneSeatThreshold ? "1" : "0";
                    return (
                      <div key={k} className="flex flex-col items-center gap-1.5">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex flex-col items-center justify-center border-2 text-base font-bold",
                          regime === "2" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-700"
                            : regime === "1" ? "bg-amber-500/10 border-amber-500/50 text-amber-700"
                            : "bg-red-500/10 border-red-500/50 text-red-700",
                        )}>
                          {regime}
                        </div>
                        <div className="text-[10px] text-muted-foreground text-center leading-tight w-14">{snap.label}</div>
                        <div className={cn(
                          "text-[10px] font-semibold",
                          regime === "2" ? "text-emerald-600" : regime === "1" ? "text-amber-600" : "text-red-600",
                        )}>{fEq.toFixed(0)}%</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                  <span><span className="font-bold text-emerald-600">● 2</span> Both founder directors safe</span>
                  <span><span className="font-bold text-amber-600">● 1</span> One seat at risk — form a bloc</span>
                  <span><span className="font-bold text-red-600">● 0</span> SHA forces resignation</span>
                </div>
              </Card>
            );
          })()}

          {/* ── Individual Founder Nomination Eligibility ── */}
          {founderOnlyHolders.length > 0 && (
            <Card className="p-4">
              <div className="font-semibold text-sm mb-1">👤 Individual Nomination Eligibility</div>
              <p className="text-xs text-muted-foreground mb-3">
                Each founder can self-nominate as a director only while they personally hold ≥5%. Below that, VCs can challenge the nomination in a shareholder vote — and win.
                A <span className="font-semibold">Founder Voting Agreement</span> (all founders pledge to vote each other in) fixes this regardless of individual stake size.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-[10px] uppercase text-muted-foreground">
                      <th className="text-left py-1.5 pr-3">Founder</th>
                      {snapKeys.map((k) => (
                        <th key={k} className="text-right py-1.5 px-2 whitespace-nowrap">{snaps[k].label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {founderOnlyHolders.map((founder) => (
                      <tr key={founder.name} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-semibold whitespace-nowrap">{founder.name}</td>
                        {snapKeys.map((k) => {
                          const h = snaps[k].holders.find((x) => x.name === founder.name);
                          const pct = h ? h.pct : 0;
                          const ineligible = pct < 5;
                          return (
                            <td key={k} className={cn("py-2 px-2 text-right font-medium", ineligible ? "text-red-600" : "text-emerald-600")}>
                              {pct.toFixed(1)}%{ineligible && <span className="ml-0.5 text-[9px]">⚠</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-[10px] text-muted-foreground bg-amber-500/5 border border-amber-500/25 rounded px-2.5 py-2 leading-relaxed">
                <span className="font-semibold text-amber-700">⚠ Red = below 5% individual floor.</span> Fix before first round: all founders sign a Voting Agreement pledging to vote their shares to elect each other as directors — this keeps 2 seats safe even after heavy individual dilution.
              </div>
            </Card>
          )}

          {/* ── Board section ── */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">🏛️ Board Composition</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {snapKeys.map((k) => {
            const snap = snaps[k];
            const total = founderSeats + 1 + snap.vcSeats;
            const fp = Math.round((founderSeats / total) * 100);
            const vp = Math.round((snap.vcSeats / total) * 100);
            const ip = 100 - fp - vp;
            const tied = snap.vcSeats === founderSeats && snap.vcSeats > 0;
            const danger = snap.vcSeats > founderSeats;
            // Board retention threshold check
            const snapFounderEquityPct = snap.holders.filter((h) => h.type === "founder").reduce((s, h) => s + h.pct, 0);
            const retentionThreshold = state.boardRetentionPct ?? (isUS ? 10 : 15);
            const belowRetention = k !== "pre" && snapFounderEquityPct < retentionThreshold;
            return (
              <Card key={k} className={cn("p-4", belowRetention && "border-red-500/50")}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground">{snap.label}</div>
                  {belowRetention && (
                    <div className="text-[10px] font-bold text-red-600 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
                      ⚠️ Below retention threshold
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Array.from({ length: founderSeats }).map((_, i) => (
                    <div key={"f" + i} className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-semibold border",
                      belowRetention
                        ? "bg-red-500/10 text-red-600 border-red-500/30 line-through opacity-60"
                        : "bg-primary/10 text-primary border-primary/30"
                    )}>Founder {i + 1}</div>
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
                  <span className="ml-auto">Founder equity: {snapFounderEquityPct.toFixed(1)}%</span>
                </div>
                <div className={cn(
                  "mt-2 inline-block text-[11px] font-bold px-3 py-1 rounded-full",
                  danger ? "bg-danger/10 text-danger" : tied ? "bg-warning/15 text-warning-foreground" : "bg-success/10 text-success",
                )}>
                  {danger ? `VC-controlled: ${vp}% vs founders ${fp}%` : tied ? `Tied — independent decides` : `Founder-controlled: ${fp}% vs ${vp}%`}
                </div>
                {/* Voting bloc strength */}
                <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <span>🗳️ Founder voting bloc:</span>
                  <span className={cn(
                    "font-semibold",
                    snapFounderEquityPct > 50 ? "text-emerald-600" : snapFounderEquityPct > 33.33 ? "text-amber-600" : "text-red-600",
                  )}>{snapFounderEquityPct.toFixed(1)}%</span>
                  <span>—</span>
                  <span className={cn(
                    snapFounderEquityPct > 50 ? "text-emerald-700" : snapFounderEquityPct > 33.33 ? "text-amber-700" : "text-red-700",
                  )}>
                    {snapFounderEquityPct > 50
                      ? "majority: can elect any director in a shareholder vote"
                      : snapFounderEquityPct > 33.33
                      ? "minority: can block special resolutions but can't control elections alone"
                      : "⚠️ below 33% — limited blocking power, VCs can pass most resolutions without you"}
                  </span>
                </div>
                {belowRetention && (
                  <div className="mt-3 p-2.5 rounded-md bg-red-500/8 border border-red-500/25 text-[11px] text-red-700 leading-relaxed">
                    <span className="font-bold">SHA Board Retention Clause triggered.</span> Founders hold {snapFounderEquityPct.toFixed(1)}% equity — below the {retentionThreshold}% threshold set in your SHA. Under standard {isUS ? "IRA / SHA" : "SHA"} language, founders are required to resign all {founderSeats} director seat{founderSeats > 1 ? "s" : ""}. The independent director and VC directors would then fully control the board.{" "}
                    <span className="font-semibold">Negotiate this clause out before signing — or push the threshold down to {isUS ? "5%" : "10%"}.</span>
                  </div>
                )}
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
              type VetoItem = { key: string; title: string; active: boolean; market: "both" | "india" | "us"; demand: string; push: string; clause: string };
              const vetoItems: VetoItem[] = ([
                // ── Universal ──────────────────────────────────────────────
                {
                  key: "equity",
                  title: "New equity issuance approval",
                  active: state.rounds.seed.enabled,
                  market: "both",
                  demand: "Approval required for any new share issuance — including to advisors, employees, or in bridge rounds.",
                  push: "Carve out: (1) ESOP grants within board-approved plan, (2) advisor grants below the pre-agreed threshold, (3) exercises of existing options. Only new round-level issuances should require VC approval.",
                  clause: "Deemed approved if VC does not respond in writing within 10 business days of written notice.",
                },
                {
                  key: "exec",
                  title: "CEO / executive hiring & firing",
                  active: state.rounds.a.enabled,
                  market: "both",
                  demand: "VC approval required to hire or remove CEO and all C-suite roles.",
                  push: "Limit veto to CEO and CFO only. Require 4/5 board votes to remove CEO. Define 'For Cause' narrowly: fraud, criminal conviction, or gross negligence — not 'underperformance'.",
                  clause: isUS
                    ? "CEO removal without Cause triggers 12-month salary, COBRA coverage, and full single-trigger acceleration of unvested equity."
                    : "Founders removed without Cause receive 6-month salary and full acceleration of unvested equity.",
                },
                {
                  key: "mna",
                  title: isUS ? "Acquisitions above $500K" : "Acquisitions above ₹4Cr (~$500K)",
                  active: state.rounds.a.enabled,
                  market: "both",
                  demand: isUS
                    ? "Any acquisition above $500K requires VC approval."
                    : "Any acquisition above ₹4Cr (~$500K) requires VC approval.",
                  push: isUS
                    ? "Raise threshold to $2M. Carve out acqui-hires under $750K (talent acquisitions with no product transfer)."
                    : "Raise threshold to ₹15Cr (~$2M). Carve out acqui-hires under ₹6Cr. Require VC response within 20 business days.",
                  clause: "VC must respond in writing within 15 business days of notice, or acquisition is deemed approved.",
                },
                {
                  key: "debt",
                  title: isUS ? "New debt above $250K" : "New debt above ₹2Cr (~$250K)",
                  active: state.rounds.seed.enabled,
                  market: "both",
                  demand: isUS
                    ? "Any new borrowing above $250K requires VC sign-off."
                    : "Any new borrowing above ₹2Cr requires VC sign-off.",
                  push: isUS
                    ? "Raise threshold to $1M. Carve out: revolving credit lines, equipment financing under $500K, government-backed loans (SBA, etc.)."
                    : "Raise threshold to ₹8Cr. Carve out: working capital revolvers, equipment financing under ₹4Cr, government-backed loans (MUDRA, SIDBI).",
                  clause: "Pre-approved for credit facilities and their renewals as disclosed in the SHA schedule.",
                },
                {
                  key: "related",
                  title: "Related party transactions",
                  active: state.rounds.seed.enabled,
                  market: "both",
                  demand: "Any transaction between the company and founders, their family, or affiliated entities requires VC consent.",
                  push: "Carve out: (1) employment agreements approved by the board, (2) expense reimbursements under ₹10L / $10K, (3) arm's-length transactions at market rate certified by auditor.",
                  clause: "Board audit committee certification sufficient for transactions under ₹1Cr / $100K. VC consent needed above that threshold.",
                },
                {
                  key: "windup",
                  title: "Voluntary liquidation / winding up",
                  active: state.rounds.seed.enabled,
                  market: "both",
                  demand: "VC must consent to any voluntary liquidation, dissolution, or cessation of business.",
                  push: "Accept this — it's standard. But push back on unilateral VC right to force wind-up: that must require 75%+ shareholder vote.",
                  clause: "No single investor or investor class can force wind-up without approval of 75% of all shareholders by value, regardless of ownership percentage.",
                },
                {
                  key: "amend",
                  title: isUS ? "Amendment of Charter / IRA / SHA" : "Amendment of SHA / AoA",
                  active: state.rounds.a.enabled,
                  market: "both",
                  demand: isUS
                    ? "Any amendment to the Certificate of Incorporation, IRA, or SHA requires VC preferred stockholder approval."
                    : "Any amendment to the SHA or Articles of Association (AoA) requires VC consent.",
                  push: isUS
                    ? "VC consent only for amendments that directly affect preferred stock rights. All other changes require 75% common + preferred shareholder vote."
                    : "VC consent only for amendments affecting VC-specific rights (liquidation preference, anti-dilution, board seats). Administrative AoA changes need 75% shareholder vote only.",
                  clause: isUS
                    ? "Amendments to Sections [X] (liquidation preference), [Y] (anti-dilution), and [Z] (board rights) require preferred approval. All others require 75% shareholder vote."
                    : "Amendments to SHA Clauses [X] (liquidation preference), [Y] (anti-dilution), and [Z] (board composition) require VC consent. All others require 75% shareholder approval.",
                },
                {
                  key: "esop",
                  title: "ESOP / option pool increase",
                  active: state.rounds.a.enabled,
                  market: "both",
                  demand: "Any ESOP pool increase above the current board-approved level requires VC approval.",
                  push: "Pre-agree a multi-year ESOP schedule (e.g., 12% now, up to 18% total by Series B) in the SHA. Increases within the schedule need board approval only — no VC veto.",
                  clause: "ESOP increases within the pre-agreed SHA schedule require board approval only. Increases beyond the schedule require VC consent within 10 business days.",
                },
                {
                  key: "ipo",
                  title: "IPO decision",
                  active: state.rounds.b.enabled,
                  market: "both",
                  demand: "VCs must approve any IPO filing, choice of exchange, and banker selection.",
                  push: "After 5 years from first close, founders can initiate IPO with 51% shareholder approval. VCs cannot veto an IPO that achieves ≥3× their cost basis.",
                  clause: isUS
                    ? "Preferred stockholder approval not required for IPO if: (i) ≥5 years since first investment, (ii) IPO price ≥3× Series A cost basis, and (iii) 51% of shareholders approve."
                    : "VC consent not required for IPO if: (i) ≥5 years since first investment, (ii) IPO price ≥3× Series A cost basis, and (iii) 51% of shareholders by value approve.",
                },
                {
                  key: "div",
                  title: "Dividend declaration",
                  active: state.rounds.seed.enabled,
                  market: "both",
                  demand: "No dividends of any kind without VC approval.",
                  push: "Accept it — it's standard. Push for one carve-out: board-approved performance bonuses and salary increases paid to employees (including founders) are explicitly not dividends.",
                  clause: "Performance bonuses and salary increases approved by the board compensation committee are explicitly excluded from the dividend restriction.",
                },
                {
                  key: "rofr",
                  title: "Right of First Refusal on founder share sales",
                  active: state.rounds.seed.enabled,
                  market: "both",
                  demand: "If any founder wants to sell shares to a third party, the company and then VCs have the right to buy those shares first at the same price.",
                  push: isUS
                    ? "Accept ROFR but limit it: (1) ROFR waived for transfers to founder's family trust or wholly-owned entity, (2) ROFR expires after IPO, (3) VCs must exercise within 10 business days or right lapses."
                    : "Accept ROFR but limit it: (1) ROFR waived for transfers to family trust or wholly-owned entity, (2) ROFR expires on IPO or trade sale, (3) VCs must exercise within 20 business days.",
                  clause: isUS
                    ? "ROFR lapses if not exercised in writing within 10 business days of notice. Permitted transfers to founder's living trust or immediate family are exempt."
                    : "ROFR lapses if not exercised in writing within 20 business days of notice. Intra-family and estate-planning transfers are exempt.",
                },
                {
                  key: "drag",
                  title: "Drag-along rights",
                  active: state.rounds.a.enabled,
                  market: "both",
                  demand: "If VCs holding X% of shares approve a sale of the company, they can force all other shareholders (including founders) to sell at the same price and terms.",
                  push: isUS
                    ? "Push for: (1) drag requires approval of ≥75% of all shareholders (not just preferred), (2) drag price must be ≥ the original Series A price, (3) founders are not dragged below their liquidation preference floor."
                    : "Push for: (1) drag requires ≥75% shareholder approval by value, (2) drag price must ≥ the last round post-money valuation, (3) founder employment contracts survive the drag.",
                  clause: isUS
                    ? "Drag-along right requires approval of: (i) a majority of the board including at least one founder director, (ii) ≥75% of preferred stockholders, and (iii) ≥51% of common stockholders."
                    : "Drag-along right requires approval of: (i) board resolution with founder director approval, (ii) ≥75% of preference shareholders, and (iii) ≥51% of equity shareholders by value.",
                },
                {
                  key: "bizchange",
                  title: "Change of principal business activity",
                  active: state.rounds.a.enabled,
                  market: "both",
                  demand: "Any material pivot away from the core business described in the SHA requires VC consent.",
                  push: "Define 'material change' narrowly: only applies to entering a completely different industry vertical. Adjacent product expansion, new geographies, and new customer segments are explicitly exempt.",
                  clause: "Change of principal business means shifting to a primary revenue activity unrelated to [defined business description]. Board-approved product pivots within the same technology domain are not a change of principal business.",
                },
                {
                  key: "keyman",
                  title: "Key man / founder departure provisions",
                  active: state.rounds.a.enabled,
                  market: "both",
                  demand: isUS
                    ? "If the CEO or a named key person leaves, VCs may have the right to suspend new investment tranches, call special meetings, or trigger mandatory buyback of unvested shares."
                    : "If the CEO or named key persons leave, VCs may have the right to suspend drawdowns, accelerate conversion of preference shares, or demand a buyback of unvested founder shares.",
                  push: "Limit key man to CEO only (not all co-founders). Key man suspension is limited to 90 days to find a replacement approved by the board. Key man does NOT trigger drag-along or preference conversion.",
                  clause: isUS
                    ? "Key man event means departure of the named CEO only. Company has 90 days to appoint a board-approved replacement. Key man does not trigger drag-along, redemption rights, or any anti-dilution adjustment."
                    : "Key man event means voluntary departure of the CEO only. Company has 90 days to appoint a board-approved replacement. Key man event does not trigger preference share conversion, drag-along, or redemption rights.",
                },
                // ── Board seat retention condition ─────────────────────────
                {
                  key: "boardretention",
                  title: "Minimum equity condition for founder board seats",
                  active: anyRoundsEnabled,
                  market: "both",
                  demand: isUS
                    ? "VCs include a 'Director Qualification Threshold' in the IRA / SHA: if founders collectively fall below 10–15% fully-diluted ownership, they must immediately resign all director seats — giving VCs and the independent full board control."
                    : "VCs include a 'Board Seat Retention Condition' in the SHA: if founders collectively fall below 15–20% equity (fully diluted), founder-nominated directors must resign, leaving board control entirely with VCs and the independent director.",
                  push: isUS
                    ? "Push for: (1) threshold at 5%, not 10–15% — meaningful dilution should not cost your seat, (2) threshold applies ONLY if the drop was from founder-initiated secondary sales, not from company-issued new equity in any board-approved round, (3) 90-day cure period to recapture equity before resignation triggers, (4) right to appoint a non-executive observer seat even after threshold breach."
                    : "Push for: (1) lower threshold to 10%, not 15–20%, (2) VC-driven dilution from Qualified Financing Rounds does NOT count toward the threshold for 12 months post-closing, (3) 90-day cure period before forced resignation, (4) if threshold is breached, founders retain the right to nominate one non-executive independent director from an agreed list.",
                  clause: isUS
                    ? "Each Founder Director shall be required to resign their director seat only if (i) the aggregate equity ownership of all Founders falls below [5]% of the Company's fully diluted capitalization, AND (ii) such decrease results from voluntary transfers or secondary sales by Founders, and not from the issuance of new Company securities in a board-approved financing. The Company shall provide written notice to Founders within 10 business days of any such breach, with a 90-day cure period prior to any required resignation."
                    : "The right of the Founders to nominate Founder Directors shall lapse only if the aggregate equity shareholding of all Founders (on a fully diluted basis, excluding shares transferred in Secondary Sales) falls below [10]% of the fully diluted share capital of the Company. For the avoidance of doubt, dilution caused by allotment of shares in any Qualified Financing Round shall not reduce the Founders' qualifying shareholding for purposes of this clause for a period of 12 (twelve) months from the date of allotment. A 90-day notice and cure period shall apply before any required resignation.",
                },
                // ── India-specific ─────────────────────────────────────────
                {
                  key: "prefconv",
                  title: "Conversion timing of preference shares / CCDs",
                  active: state.rounds.seed.enabled,
                  market: "india",
                  demand: "VCs control when preference shares or CCDs convert to equity — including the right to delay conversion if conversion would be dilutive to their returns.",
                  push: "Specify mandatory conversion triggers in the SHA: (1) qualified IPO, (2) trade sale above agreed floor valuation, (3) at VC's election after 5 years. Prohibit VC-triggered conversion without corresponding liquidation event.",
                  clause: "Compulsory conversion occurs on: (i) qualified IPO at price ≥ 2× subscription price, (ii) trade sale at aggregate valuation ≥ ₹[X]Cr, or (iii) VC election after 60 months from allotment. Conversion price floor = subscription price.",
                },
                {
                  key: "auditor",
                  title: "Change of statutory auditor",
                  active: state.rounds.seed.enabled,
                  market: "india",
                  demand: "Appointment or change of statutory auditor (as required under Companies Act 2013) requires VC consent — VCs want a Big 4 or recognised firm auditing their investment.",
                  push: "Accept that a recognised statutory auditor is required, but push: (1) initial auditor choice is a founder decision at pre-seed, (2) from Seed onward, VC approval is only required if switching to a non-Big 4 / non-recognised firm, (3) auditor change for cost reasons must be pre-approved in annual budget.",
                  clause: "Change of statutory auditor requires board approval. Switch to a firm not in the pre-agreed approved list (to be annexed to SHA) requires VC consent. Annual auditor reappointment does not require VC consent.",
                },
                // ── US-specific ────────────────────────────────────────────
                {
                  key: "qsbs",
                  title: "QSBS eligibility — Section 1202 protection",
                  active: state.rounds.seed.enabled,
                  market: "us",
                  demand: "VCs will veto any corporate action that could disqualify their shares from Section 1202 QSBS tax treatment — worth up to $10M per investor in tax-free gains on exit.",
                  push: "This is largely in founders' interest too. Push to add a QSBS compliance covenant: company will provide written notice before any action that could breach QSBS requirements (>$50M gross assets, non-qualified business type, stock repurchases within 2 years of issuance).",
                  clause: "Company shall provide written notice to all investors at least 30 days prior to any action that would cause the company's stock to cease to qualify as QSBS under Section 1202 of the IRC.",
                },
                {
                  key: "repurchase",
                  title: "Stock repurchase (NVCA standard)",
                  active: state.rounds.seed.enabled,
                  market: "us",
                  demand: "No repurchase or redemption of any company stock without preferred stockholder approval — standard NVCA Model Protective Provision.",
                  push: "Accept the restriction but negotiate carve-outs: (1) repurchases pursuant to equity incentive agreements at cost (leavers), (2) repurchases at board-approved prices from terminated employees, (3) any repurchase where preferred stockholders are offered the same terms.",
                  clause: "Company may repurchase securities without preferred stockholder approval only: (i) pursuant to equity incentive plan repurchase rights at not more than cost, or (ii) pursuant to board-approved buybacks offered pro-rata to all stockholders.",
                },
                {
                  key: "authshares",
                  title: "Authorized share class increase (Delaware)",
                  active: state.rounds.a.enabled,
                  market: "us",
                  demand: "Any increase in the number of authorized shares in the Certificate of Incorporation requires preferred stockholder approval — VCs use this to control future dilution.",
                  push: "Negotiate a pre-approved 'authorized headroom' in the initial Certificate: authorize 2–3× the current issued shares so routine ESOP grants and bridge rounds don't trigger this veto. Future increases beyond headroom require approval.",
                  clause: "Certificate of Incorporation to authorize [X] shares initially, representing approximately 3× current issued shares. Subsequent amendments to increase authorization require approval of holders of ≥60% of preferred stock, voting as a separate class.",
                },
              ] as VetoItem[]).filter((it) => it.market === "both" || (isUS ? it.market === "us" : it.market === "india"));

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
            <div className="font-bold text-sm mb-1">🎯 Key Ownership Thresholds</div>
            <div className="text-xs text-muted-foreground mb-4">Tap any threshold to see exactly what powers change hands when it is crossed.</div>
            {(() => {
              const thresholds = [
                {
                  key: "t75",
                  label: "Founders supermajority",
                  threshold: "75%",
                  ok: founderPct > 75,
                  current: founderPct,
                  who: "founders",
                  meaning: isUS
                    ? "Under DGCL and most VCs' Voting Agreements, a 75% supermajority is required for major structural changes — Charter amendments, mergers, dissolution, and new share class creation all fall here."
                    : "Under the Companies Act 2013, special resolutions require 75% of votes cast. These cover: AoA amendments, mergers, change of company name, capital reduction, winding up, and any new share class with different rights.",
                  whenSafe: "Founders can pass special resolutions unilaterally — including AoA/Charter amendments, structural changes, and major transactions — without requiring VC support.",
                  whenBreached: isUS
                    ? "VCs holding >25% can block any Charter amendment, merger, dissolution, or new share class. You cannot restructure the company, set up dual-class shares, or wind up without their consent."
                    : "Any VC holding >25% can single-handedly block all special resolutions. This means no AoA amendments, no mergers, no capital restructuring, no winding up — without their blessing. This is the most powerful blocking right in Indian company law.",
                  marketNote: isUS ? null : "India-specific: the 75%/25% threshold is hard-coded into the Companies Act. Unlike contractual rights, it cannot be waived by SHA — it is always in effect regardless of what the SHA says.",
                },
                {
                  key: "t51",
                  label: "Founders simple majority",
                  threshold: "51%",
                  ok: founderPct > 51,
                  current: founderPct,
                  who: "founders",
                  meaning: isUS
                    ? "Ordinary resolutions in the US require a simple majority of votes cast. These cover day-to-day governance: approving financial statements, electing directors at shareholder meetings, and approving most standard transactions."
                    : "Ordinary resolutions under Companies Act 2013 need >50% of votes cast. They cover: approval of financial accounts, appointment / removal of non-executive directors, related-party transactions above certain thresholds, and routine approvals.",
                  whenSafe: "Founders can independently pass all ordinary resolutions — routine approvals, financial accounts, director appointments — without needing VC votes. Company governance runs on founder terms.",
                  whenBreached: isUS
                    ? "VCs can combine to pass ordinary resolutions without founders. They can approve related-party transactions, remove non-executive directors, and block annual accounts. They cannot yet run the company but can create significant friction in day-to-day governance."
                    : "VCs can pass ordinary resolutions without founders — approving accounts, appointing auditors, approving transactions with VC-affiliated entities, removing directors at the shareholder level. Founders lose the ability to approve anything without VC support.",
                  marketNote: null,
                },
                {
                  key: "t26",
                  label: "VC blocking minority",
                  threshold: "26%",
                  ok: vcPct < 26,
                  current: vcPct,
                  who: "vcs",
                  meaning: isUS
                    ? "Once VCs hold >25% of voting shares (or have contractual protective provisions), they can block most major structural changes under the SHA and Voting Agreement even without holding a majority."
                    : "This is the most important threshold in Indian company law. Once any investor (or group acting in concert) crosses 26%, they can block ALL special resolutions — permanently — regardless of what the SHA says, because the Companies Act is a statutory right that overrides contracts.",
                  whenSafe: "VCs cannot unilaterally block special resolutions. You can pass major structural changes, AoA amendments, and mergers with the support of other shareholders — VCs cannot single-handedly stop you.",
                  whenBreached: isUS
                    ? "VCs can block Charter amendments, new share classes, mergers, and dissolution. Their consent is needed for any major structural change — effectively a permanent veto on company structure, regardless of board dynamics."
                    : "This is a CODE RED: VCs can now block every special resolution under the Companies Act. You cannot change the AoA, merge, reduce capital, wind up, or issue new share classes without their consent. This right exists in law — no SHA clause can take it away. The only way out is buying back their shares.",
                  marketNote: isUS ? null : "India only: the 26% blocking threshold is a statutory right under Companies Act s.114. It is not a contractual right — it cannot be modified by the SHA. Once crossed, it is permanent unless you buy back sufficient shares.",
                },
                {
                  key: "t50vc",
                  label: "VC combined majority",
                  threshold: "50%",
                  ok: vcPct < 50,
                  current: vcPct,
                  who: "vcs",
                  meaning: "Once VCs combined hold >50% of total equity (and therefore voting rights, assuming single-class shares), they can pass ordinary resolutions without founders. Combined with their board seats, this gives VCs effective operational control of the company.",
                  whenSafe: "No single VC combination can pass ordinary resolutions without at least one founder's vote. Day-to-day governance, financial approvals, and director appointments all require founder participation.",
                  whenBreached: isUS
                    ? "VCs can pass ordinary resolutions without founders — elect new directors at shareholder level, approve accounts, approve VC-affiliated transactions, and block resolutions founders bring. Combined with board control, they can effectively run the company without you."
                    : "VCs can pass all ordinary resolutions without founder votes. They can appoint and remove non-executive directors, approve related-party transactions (even with VC-affiliated entities), and approve financial accounts — all without you. This is effective shareholder-level control.",
                  marketNote: null,
                },
                {
                  key: "t10",
                  label: "VC requisition right",
                  threshold: "10%",
                  ok: vcPct < 10,
                  current: vcPct,
                  who: "vcs",
                  meaning: isUS
                    ? "Under most state laws and Voting Agreements, shareholders holding ≥10% of voting shares can demand a special shareholder meeting for any purpose. VCs use this to put hostile resolutions to a shareholder vote outside the normal AGM cycle."
                    : "Under Companies Act 2013 s.100, shareholders holding ≥10% of paid-up share capital can requisition an Extraordinary General Meeting (EGM). This right activates for virtually any VC after Seed round and is used to put resolutions directly to shareholders — bypassing the board.",
                  whenSafe: "No investor can force an extraordinary shareholder meeting. You control the meeting calendar and agenda. VCs can only raise issues through the board, which you control.",
                  whenBreached: isUS
                    ? "Any VC holding ≥10% can call a special shareholder meeting at any time to put resolutions to a vote — including resolutions to remove directors, approve transactions, or amend governance documents. The board cannot block this."
                    : "Any VC with ≥10% can requisition an EGM within 21 days. They set the agenda. The board must hold the EGM within 45 days or the requisitionists can convene it themselves. VCs use this to escalate governance disputes outside normal channels.",
                  marketNote: null,
                },
              ];
              return (
                <Accordion type="single" collapsible className="w-full space-y-1">
                  {thresholds.map((t) => (
                    <AccordionItem
                      key={t.key}
                      value={t.key}
                      className={cn(
                        "rounded-md border px-3",
                        t.ok ? "border-emerald-300/60 bg-emerald-500/5" : "border-red-400/60 bg-red-500/5",
                      )}
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", t.ok ? "bg-emerald-500" : "bg-red-500")} />
                            <span className="text-sm font-semibold text-left">{t.label}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">({t.who === "founders" ? `founders at ${t.current.toFixed(1)}%` : `VCs at ${t.current.toFixed(1)}%`})</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-bold text-muted-foreground">{t.threshold}</span>
                            <Badge className={cn("text-[10px]", t.ok ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30" : "bg-red-500/15 text-red-600 border border-red-500/30")}>
                              {t.ok ? "SAFE" : "BREACHED"}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-3">
                        <div className="space-y-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Why this threshold matters</div>
                            <div className="text-xs leading-relaxed">{t.meaning}</div>
                          </div>
                          <div className={cn("rounded-lg p-2.5 border", t.ok ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" : "bg-muted border-border")}>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-1">✅ While SAFE ({t.threshold} not yet crossed)</div>
                            <div className="text-xs leading-relaxed">{t.whenSafe}</div>
                          </div>
                          <div className={cn("rounded-lg p-2.5 border", !t.ok ? "bg-red-50/80 border-red-200 dark:bg-red-950/20 dark:border-red-800" : "bg-muted border-border")}>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">🚨 Once BREACHED ({t.threshold} crossed)</div>
                            <div className="text-xs leading-relaxed">{t.whenBreached}</div>
                          </div>
                          {t.marketNote && (
                            <div className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-2 dark:bg-blue-950/20 dark:border-blue-800">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">📍 {isUS ? "US" : "India"} specific</div>
                              <div className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">{t.marketNote}</div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
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
                  {fPayouts.map((f) => {
                    const vestingEnabled = state.vestingEnabled ?? false;
                    const accelerated = state.accelerationAtExit ?? true;
                    const showVesting = vestingEnabled;
                    const vestedPct = Math.round(f.vestedFraction * 100);
                    return (
                      <tr key={f.name} className="border-b last:border-0">
                        <td className="py-1.5">
                          <strong>{f.name}</strong>{" "}
                          <span className="text-muted-foreground">({f.role})</span>
                          {showVesting && (
                            <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold"
                              style={{ backgroundColor: accelerated ? "#dcfce7" : vestedPct < 50 ? "#fee2e2" : "#fef9c3", color: accelerated ? "#16a34a" : vestedPct < 50 ? "#dc2626" : "#92400e" }}>
                              {accelerated ? "⚡ Accelerated" : `${vestedPct}% vested`}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-right font-bold" style={{ color: HOLDER_COLORS[f.name] }}>{fmtM(f.payout)}</td>
                      </tr>
                    );
                  })}
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
