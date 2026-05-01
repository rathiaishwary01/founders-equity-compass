export type HolderType = "founder" | "esop" | "advisory" | "vc" | "safe";

export interface Holder {
  name: string;
  role: string;
  pct: number;
  type: HolderType;
}

export type RoundKey = "preseed" | "seed" | "a" | "b" | "c";

export interface RoundConfig {
  enabled: boolean;
  preMoney: number;
  raise: number;
  esop: number;
  /** "observer" | "1" | "2" */
  board: string;
  prefMult: number;
  prefType: "non" | "part";
  secondary: number;
  prorata: number;
  /**
   * Redemption rights — investor can force company to buy back shares after trigger period.
   * Default: disabled. If enabled, total liability = investment × redemptionMultiple.
   */
  redemptionEnabled?: boolean;
  /** Years after investment close before redemption right can be exercised (typical: 5) */
  redemptionYears?: number;
  /** Redemption price multiple on original investment (1.0 = cost, 1.25 = cost + 25% premium) */
  redemptionMultiple?: number;

  /**
   * Anti-dilution protection for this round's investors.
   * "none"         — no protection (common for angel/pre-seed)
   * "bbwa"         — broad-based weighted average (market standard for institutional rounds)
   * "full-ratchet" — conversion price fully resets to the new (down) round price.
   *                  In a 50% down round, the VC's stake doubles entirely at founder expense.
   *                  Never accept this — it is not market standard in any geography.
   */
  antiDilution: "none" | "bbwa" | "full-ratchet";
  /**
   * Pay-to-play: if an investor in this round fails to participate pro-rata
   * in a future financing, their preferred shares convert to common (or to
   * shadow preferred with no anti-dilution and 1× non-participating pref).
   * This is a FOUNDER-PROTECTIVE clause — always demand it.
   * Market standard: US (post-Series A common); India (less common, but
   * Elevation/Sequoia-India deals increasingly include it).
   */
  payToPlay?: boolean;
}

export interface SafeConfig {
  enabled: boolean;
  amount: number;
  cap: number;
  discount: number;
  /** MFN / no-cap: converts at the next round's pre-money price (same as investors) */
  mfn: boolean;
}

export type Market = "india" | "us";

/**
 * Describes the founder's location and entity structure choice.
 * This drives which compliance guidance, signals, and recommendations are shown.
 *
 * - "india-only"    Indian founders, India Pvt Ltd entity, raising from Indian VCs only
 * - "india-flip"    Indian founders staying in India, creating Delaware C-Corp via LLP route
 * - "india-us-move" Indian founders permanently relocating to US, direct Delaware ownership
 * - "us"            US-based founders, standard Delaware playbook
 */
export type FounderStructure = "india-only" | "india-flip" | "india-us-move" | "us";

export interface VestingConfig {
  /** Months before any equity vests (default 12) */
  cliffMonths: number;
  /** Total vesting period in months (default 48 = 4 years) */
  vestMonths: number;
  /** Months elapsed since grant date */
  elapsedMonths: number;
}

export const DEFAULT_VESTING: VestingConfig = {
  cliffMonths: 12,
  vestMonths: 48,
  elapsedMonths: 0,
};

export interface SimulatorState {
  founderSeats: number;
  market: Market;
  founderStructure: FounderStructure;
  safe: SafeConfig;
  rounds: Record<RoundKey, RoundConfig>;
  exitValue: number;
  usePref: boolean;
  /** Whether to apply vesting to founder exit payouts */
  vestingEnabled: boolean;
  /**
   * Single-trigger acceleration: if true, all unvested equity vests at acquisition.
   * This is the market standard — always negotiate for it.
   */
  accelerationAtExit: boolean;
  /** Per-founder vesting schedules, keyed by founder name */
  vesting: Record<string, VestingConfig>;
  /**
   * Pre-funding cap table. When undefined, falls back to INITIAL_HOLDERS.
   * Includes all holder types (founder, esop, advisory).
   */
  founders?: Holder[];
  /**
   * Minimum collective founder equity % required to retain board seats.
   * If founders drop below this threshold (due to dilution / secondary sales),
   * the SHA/Voting Agreement typically requires them to resign their director seats.
   * India default: 15% | US default: 10%
   */
  boardRetentionPct?: number;
}

export interface RoundData {
  vcName: string;
  investment: number;
  prefMult: number;
  prefType: "non" | "part";
  type: "vc" | "safe";
  /** Post-money valuation at time of this VC's round — used for BBWA anti-dilution calc */
  postMoney: number;
  /** Which RoundKey this investor belongs to — used to look up antiDilution config */
  roundKey: string;
}

export interface Snapshot {
  key: string;
  label: string;
  holders: Holder[];
  vcSeats: number;
  vcObs: number;
  valuation: number | null;
  vcNames: string[];
  roundData: RoundData[];
  isDownRound: boolean;
  valDrop: number;
  secondary: number;
  secPct: number;
  prorata: number;
}

export const INITIAL_HOLDERS: Holder[] = [
  { name: "Founder 1", role: "CEO", pct: 30, type: "founder" },
  { name: "Founder 2", role: "CTO", pct: 30, type: "founder" },
  { name: "Founder 3", role: "COO", pct: 30, type: "founder" },
  { name: "ESOP Pool", role: "Employees", pct: 8.0, type: "esop" },
  { name: "Advisory Pool", role: "Advisors", pct: 2.0, type: "advisory" },
];

export const HOLDER_COLORS: Record<string, string> = {
  "Founder 1": "#4361ee",
  "Founder 2": "#3a0ca3",
  "Founder 3": "#7209b7",
  "Founder 4": "#f72585",
  "ESOP Pool": "#4cc9f0",
  "Advisory Pool": "#90be6d",
  "SAFE Investors": "#f59e0b",
  "Pre-seed VC": "#06b6d4",
  "Seed VC": "#e17055",
  "Series A VC": "#d63031",
  "Series B VC": "#c0392b",
  "Series C VC": "#922b21",
};

// India default round sizes (in $M) — based on Inc42 / Bain India VC Report 2023-24
// Pre-seed: ₹1–3Cr raise, angel/accelerator stage
// Seed: $0.5–3M raise, $3–10M pre-money (Blume, Kalaari, Stellaris, 3one4)
// Series A: $5–15M raise, $15–50M pre-money
// Series B: $20–50M raise, $60–180M pre-money
// Series C: $40–120M raise, $150–500M pre-money
export const INDIA_DEFAULT_ROUNDS: SimulatorState["rounds"] = {
  preseed: { enabled: false, preMoney: 1.5,  raise: 0.15,  esop: 0,  board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "none" },
  seed:    { enabled: false, preMoney: 5,    raise: 1.25,  esop: 10, board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "bbwa" },
  a:       { enabled: false, preMoney: 18,   raise: 6,     esop: 12, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "bbwa" },
  b:       { enabled: false, preMoney: 70,   raise: 20,    esop: 12, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "bbwa" },
  c:       { enabled: false, preMoney: 180,  raise: 45,    esop: 12, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "bbwa" },
};

// US default round sizes (in $M) — larger tickets, higher valuations
export const US_DEFAULT_ROUNDS: SimulatorState["rounds"] = {
  preseed: { enabled: false, preMoney: 1.661, raise: 0.125, esop: 0, board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "none" },
  seed:    { enabled: false, preMoney: 8,     raise: 2,     esop: 10, board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "bbwa" },
  a:       { enabled: false, preMoney: 20,    raise: 5,     esop: 15, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "bbwa" },
  b:       { enabled: false, preMoney: 70,    raise: 20,    esop: 15, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "bbwa" },
  c:       { enabled: false, preMoney: 200,   raise: 50,    esop: 12, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0, antiDilution: "bbwa" },
};

export const DEFAULT_STATE: SimulatorState = {
  founderSeats: 2,
  market: "india",
  founderStructure: "india-flip",
  safe: { enabled: false, amount: 0.25, cap: 3, discount: 20, mfn: false },
  rounds: INDIA_DEFAULT_ROUNDS,
  exitValue: 100,
  usePref: true,
  vestingEnabled: false,
  accelerationAtExit: true,
  vesting: {},
};

export const ROUND_KEYS: RoundKey[] = ["preseed", "seed", "a", "b", "c"];

export const ROUND_LABELS: Record<RoundKey, string> = {
  preseed: "Pre-seed",
  seed: "Seed",
  a: "Series A",
  b: "Series B",
  c: "Series C",
};

export const ROUND_ICONS: Record<RoundKey, string> = {
  preseed: "🤝",
  seed: "🌱",
  a: "🚀",
  b: "📈",
  c: "🏆",
};

// India dilution benchmarks — what's considered founder-friendly vs. aggressive
// Source: Inc42 State of Indian Startup Ecosystem 2024, Bain India PE/VC Report 2023,
//         Tracxn deal data, and anecdotal from Blume/3one4/Elevation term sheets
// Note: Indian VCs take larger equity stakes than US peers for equivalent round sizes
export const ROUND_BENCHMARKS: Record<RoundKey, { lo: number; hi: number }> = {
  preseed: { lo: 5,  hi: 15 }, // Angel/accelerator: 5–10% is good, >15% is aggressive
  seed:    { lo: 15, hi: 25 }, // India Seed: VCs target 15–20%, >25% is expensive
  a:       { lo: 18, hi: 28 }, // India Series A: 18–25% typical; >28% = overpaying for capital
  b:       { lo: 15, hi: 25 }, // India Series B: 15–22% typical
  c:       { lo: 12, hi: 20 }, // India Series C: 12–18% typical for late-stage
};

// US dilution benchmarks — tighter ranges, higher valuations relative to raise
// Source: NVCA Yearbook 2024, Carta State of Private Markets, YC deal data
export const US_ROUND_BENCHMARKS: Record<RoundKey, { lo: number; hi: number }> = {
  preseed: { lo: 5,  hi: 15 }, // YC / angels: 7% (YC standard), up to 15%
  seed:    { lo: 15, hi: 25 }, // US Seed: 15–20% typical, >25% is aggressive
  a:       { lo: 15, hi: 25 }, // US Series A: 15–22% typical (NVCA median ~20%)
  b:       { lo: 12, hi: 22 }, // US Series B: 12–18% typical
  c:       { lo: 10, hi: 18 }, // US Series C: 10–15% typical (compressed by high valuations)
};

// Human-readable benchmark context shown in the UI dilution bar
export const ROUND_BENCHMARK_NOTES: Record<string, Record<RoundKey, string>> = {
  india: {
    preseed: "India angels/accelerators typically take 5–10%",
    seed:    "India Seed VCs (Blume, 3one4, Stellaris) typically take 15–20%",
    a:       "India Series A (Elevation, Kalaari, Accel) typically take 18–25%",
    b:       "India Series B typically 15–22%; Tiger/SoftBank can go lower at high valuations",
    c:       "India Series C+ typically 12–18%",
  },
  us: {
    preseed: "YC takes 7%; other angels/accelerators 5–15%",
    seed:    "US Seed VCs typically take 15–20% (NVCA median)",
    a:       "US Series A: Sequoia/a16z/Benchmark typically take 15–22%",
    b:       "US Series B: 12–18% typical; top-tier VCs often below 15%",
    c:       "US Series C+: 10–15% at compressed multiples",
  },
};
