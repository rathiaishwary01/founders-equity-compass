import {
  INITIAL_HOLDERS,
  ROUND_LABELS,
  type Holder,
  type RoundData,
  type RoundKey,
  type SimulatorState,
  type Snapshot,
} from "./types";

/**
 * Compute snapshot per round, applying SAFE conversion, dilution, ESOP top-up,
 * and secondary sales. Returns map keyed by 'pre','seed','a','b','c'.
 *
 * BUG FIX 4 — ESOP top-up no longer double-counts. We compute the top-up
 * delta (esopTarget - currentEsop), dilute all OTHER holders to make room
 * for exactly that delta, and set esopH.pct = esopTarget directly.
 */
export function computeSnaps(state: SimulatorState): Record<string, Snapshot> {
  const snaps: Record<string, Snapshot> = {};
  snaps["pre"] = {
    key: "pre",
    label: "Pre-Funding",
    holders: INITIAL_HOLDERS.map((h) => ({ ...h })),
    vcSeats: 0,
    vcObs: 0,
    valuation: null,
    vcNames: [],
    roundData: [],
    isDownRound: false,
    valDrop: 0,
    secondary: 0,
    secPct: 0,
    prorata: 0,
  };

  let cur: Holder[] = INITIAL_HOLDERS.map((h) => ({ ...h }));
  let boardVcSeats = 0;
  let boardVcObs = 0;
  const vcNames: string[] = [];
  const roundData: RoundData[] = [];
  let safeApplied = false;
  let prevPostMoney: number | null = null;

  const safe = state.safe;
  const order: RoundKey[] = ["preseed", "seed", "a", "b", "c"];

  for (const key of order) {
    // Backward-compatible: old saved scenarios may not have 'preseed' in rounds
    const r = state.rounds[key];
    if (!r || !r.enabled) continue;
    const { preMoney: pre, raise: inv, esop: esopT, board: boardC, prefMult, prefType } = r;
    if (!pre || !inv) continue;

    // ── SAFE converts at first priced round ──
    // MFN / no-cap: effPre = this round's pre-money (same price as round investors)
    if (safe.enabled && !safeApplied && safe.amount > 0 && (safe.mfn || safe.cap > 0)) {
      const effPre = safe.mfn
        ? pre
        : Math.min(safe.cap, pre * (1 - safe.discount / 100));
      const safePct = (safe.amount / (effPre + safe.amount)) * 100;
      const existTotal2 = cur.reduce((s, h) => s + h.pct, 0);
      const scale2 = (100 - safePct) / existTotal2;
      cur = cur.map((h) => ({ ...h, pct: h.pct * scale2 }));
      cur.push({ name: "SAFE Investors", role: "Pre-Seed SAFE", pct: safePct, type: "safe" });
      roundData.push({ vcName: "SAFE Investors", investment: safe.amount, prefMult: 1, prefType: "non", type: "safe" });
      safeApplied = true;
    }

    const post = pre + inv;
    const dilFactor = pre / post;
    const vcPct = (inv / post) * 100;
    const vcName = ROUND_LABELS[key] + " VC";
    vcNames.push(vcName);

    // 1. Apply VC dilution
    cur = cur.map((h) => ({ ...h, pct: h.pct * dilFactor }));

    // 2. ESOP top-up (BUG FIX 4)
    const esopH = cur.find((h) => h.name === "ESOP Pool");
    if (esopH && esopH.pct < esopT) {
      const topup = esopT - esopH.pct;
      // Dilute everyone EXCEPT ESOP to make room for the delta.
      const nonEsopTotal = cur.reduce((s, h) => (h.name === "ESOP Pool" ? s : s + h.pct), 0);
      // After top-up, ESOP = esopT, and total non-esop should = currentTotal - topup
      // currentTotal = nonEsopTotal + esopH.pct
      // We need nonEsopTotal scaled so that scaled + esopT = nonEsopTotal + esopH.pct
      // → scaled = nonEsopTotal + esopH.pct - esopT
      // → scale  = (nonEsopTotal - topup) / nonEsopTotal
      const scale = (nonEsopTotal - topup) / nonEsopTotal;
      cur = cur.map((h) => (h.name === "ESOP Pool" ? { ...h, pct: esopT } : { ...h, pct: h.pct * scale }));
    }

    // 3. Now scale existing to (100 - vcPct), add VC
    const existTotal = cur.reduce((s, h) => s + h.pct, 0);
    const scale = (100 - vcPct) / existTotal;
    cur = cur.map((h) => ({ ...h, pct: h.pct * scale }));
    cur.push({ name: vcName, role: ROUND_LABELS[key] + " Investor", pct: vcPct, type: "vc" });

    // 4. Board
    if (boardC === "observer") boardVcObs++;
    else boardVcSeats += parseInt(boardC, 10);

    roundData.push({ vcName, investment: inv, prefMult, prefType, type: "vc" });

    // 5. Secondary
    let secPct = 0;
    if (r.secondary > 0 && post > 0) {
      secPct = (r.secondary / post) * 100;
      const fdrTotal = cur.filter((h) => h.type === "founder").reduce((s, h) => s + h.pct, 0);
      if (fdrTotal > secPct) {
        cur = cur.map((h) => {
          if (h.type === "founder") return { ...h, pct: h.pct - (h.pct / fdrTotal) * secPct };
          if (h.name === vcName) return { ...h, pct: h.pct + secPct };
          return h;
        });
      }
    }

    // 6. Down-round detection
    const isDownRound = prevPostMoney !== null && pre < prevPostMoney;
    const valDrop = isDownRound && prevPostMoney !== null ? Math.round(((prevPostMoney - pre) / prevPostMoney) * 100) : 0;
    prevPostMoney = post;

    snaps[key] = {
      key,
      label: ROUND_LABELS[key],
      holders: cur.map((h) => ({ ...h })),
      vcSeats: boardVcSeats,
      vcObs: boardVcObs,
      valuation: post,
      vcNames: [...vcNames],
      roundData: [...roundData],
      isDownRound,
      valDrop,
      secondary: r.secondary,
      secPct,
      prorata: r.prorata,
    };
  }

  return snaps;
}

/** Pure exit payout calculator. */
export function calcPayouts(snap: Snapshot, exitVal: number, usePref: boolean): Record<string, number> {
  const holders = snap.holders;
  const rData = (snap.roundData || []).filter((r) => r.type === "vc");
  const payouts: Record<string, number> = {};
  holders.forEach((h) => (payouts[h.name] = 0));

  if (!usePref || rData.length === 0) {
    holders.forEach((h) => (payouts[h.name] = (exitVal * h.pct) / 100));
    return payouts;
  }

  const prefMap: Record<string, { prefAmt: number; prefType: "non" | "part"; investment: number }> = {};
  rData.forEach((r) => {
    prefMap[r.vcName] = { prefAmt: r.investment * r.prefMult, prefType: r.prefType, investment: r.investment };
  });
  const totalPref = Object.values(prefMap).reduce((s, p) => s + p.prefAmt, 0);

  if (exitVal <= totalPref) {
    Object.entries(prefMap).forEach(([name, p]) => {
      payouts[name] = exitVal * (p.prefAmt / totalPref);
    });
    return payouts;
  }

  const converting = new Set<string>();
  Object.entries(prefMap).forEach(([name, p]) => {
    if (p.prefType === "non") {
      const h = holders.find((x) => x.name === name);
      if (h && (exitVal * h.pct) / 100 > p.prefAmt) converting.add(name);
    }
  });

  let remaining = exitVal;
  Object.entries(prefMap).forEach(([name, p]) => {
    if (!converting.has(name) && p.prefType === "non") {
      payouts[name] += p.prefAmt;
      remaining -= p.prefAmt;
    }
    if (p.prefType === "part") {
      payouts[name] += p.prefAmt;
      remaining -= p.prefAmt;
    }
  });

  const participantPct: Record<string, number> = {};
  holders.forEach((h) => {
    const isPart = prefMap[h.name] && prefMap[h.name].prefType === "part";
    const isConv = converting.has(h.name);
    const isCommon = !prefMap[h.name] || h.type === "safe";
    if (isPart || isConv || isCommon) participantPct[h.name] = h.pct;
  });
  const totalPctP = Object.values(participantPct).reduce((s, p) => s + p, 0);
  if (totalPctP > 0) {
    Object.entries(participantPct).forEach(([name, pct]) => {
      payouts[name] += (remaining * pct) / totalPctP;
    });
  }

  return payouts;
}

/** Get the latest snapshot (last enabled round) or 'pre'. */
export function latestSnap(snaps: Record<string, Snapshot>): Snapshot {
  const keys = Object.keys(snaps);
  return snaps[keys[keys.length - 1]];
}

/** BUG FIX 1 — per-founder payouts based on their ACTUAL pct of latest snapshot. */
export function founderPayouts(
  snap: Snapshot,
  exitVal: number,
  usePref: boolean,
): { name: string; role: string; payout: number }[] {
  const payouts = calcPayouts(snap, exitVal, usePref);
  return INITIAL_HOLDERS.filter((h) => h.type === "founder").map((f) => ({
    name: f.name,
    role: f.role,
    payout: payouts[f.name] || 0,
  }));
}

export const fmtVal = (v: number | null): string => {
  if (!v) return "—";
  if (v >= 1000) return "$" + (v / 1000).toFixed(1) + "B";
  return "$" + v.toFixed(1) + "M";
};

export const fmtM = (v: number | null | undefined): string => {
  if (v === undefined || v === null) return "—";
  if (Math.abs(v) >= 1000) return "$" + (v / 1000).toFixed(2) + "B";
  if (Math.abs(v) >= 1) return "$" + v.toFixed(2) + "M";
  return "$" + (v * 1000).toFixed(0) + "K";
};
