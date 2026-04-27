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

export interface SimulatorState {
  founderSeats: number;
  market: Market;
  safe: SafeConfig;
  rounds: Record<RoundKey, RoundConfig>;
  exitValue: number;
  usePref: boolean;
}

export interface RoundData {
  vcName: string;
  investment: number;
  prefMult: number;
  prefType: "non" | "part";
  type: "vc" | "safe";
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
  { name: "Nikhil Gundawar", role: "CEO", pct: 32.4, type: "founder" },
  { name: "Mihir Dash", role: "CTO/AI", pct: 25.2, type: "founder" },
  { name: "Aishwary Rathi", role: "COO", pct: 16.2, type: "founder" },
  { name: "Bhavuk Manocha", role: "CSO", pct: 16.2, type: "founder" },
  { name: "ESOP Pool", role: "Employees", pct: 8.0, type: "esop" },
  { name: "Advisory Pool", role: "Advisors", pct: 2.0, type: "advisory" },
];

export const HOLDER_COLORS: Record<string, string> = {
  "Nikhil Gundawar": "#4361ee",
  "Mihir Dash": "#3a0ca3",
  "Aishwary Rathi": "#7209b7",
  "Bhavuk Manocha": "#f72585",
  "ESOP Pool": "#4cc9f0",
  "Advisory Pool": "#90be6d",
  "SAFE Investors": "#f59e0b",
  "Pre-seed VC": "#06b6d4",
  "Seed VC": "#e17055",
  "Series A VC": "#d63031",
  "Series B VC": "#c0392b",
  "Series C VC": "#922b21",
};

// India default round sizes (in $M)
export const INDIA_DEFAULT_ROUNDS: SimulatorState["rounds"] = {
  preseed: { enabled: false, preMoney: 1.661, raise: 0.125, esop: 0, board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  seed:    { enabled: false, preMoney: 2.5,   raise: 0.5,   esop: 10, board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  a:       { enabled: false, preMoney: 10,    raise: 3,     esop: 12, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  b:       { enabled: false, preMoney: 40,    raise: 10,    esop: 12, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  c:       { enabled: false, preMoney: 100,   raise: 25,    esop: 12, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
};

// US default round sizes (in $M) — larger tickets, higher valuations
export const US_DEFAULT_ROUNDS: SimulatorState["rounds"] = {
  preseed: { enabled: false, preMoney: 1.661, raise: 0.125, esop: 0, board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  seed:    { enabled: false, preMoney: 8,     raise: 2,     esop: 10, board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  a:       { enabled: false, preMoney: 20,    raise: 5,     esop: 15, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  b:       { enabled: false, preMoney: 70,    raise: 20,    esop: 15, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  c:       { enabled: false, preMoney: 200,   raise: 50,    esop: 12, board: "1",        prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
};

export const DEFAULT_STATE: SimulatorState = {
  founderSeats: 2,
  market: "india",
  safe: { enabled: false, amount: 0.25, cap: 3, discount: 20, mfn: false },
  rounds: INDIA_DEFAULT_ROUNDS,
  exitValue: 100,
  usePref: true,
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

// India dilution benchmarks
export const ROUND_BENCHMARKS: Record<RoundKey, { lo: number; hi: number }> = {
  preseed: { lo: 5,  hi: 12 },
  seed:    { lo: 12, hi: 20 },
  a:       { lo: 15, hi: 25 },
  b:       { lo: 15, hi: 22 },
  c:       { lo: 12, hi: 20 },
};

// US dilution benchmarks
export const US_ROUND_BENCHMARKS: Record<RoundKey, { lo: number; hi: number }> = {
  preseed: { lo: 5,  hi: 15 },
  seed:    { lo: 15, hi: 25 },
  a:       { lo: 15, hi: 25 },
  b:       { lo: 15, hi: 22 },
  c:       { lo: 12, hi: 20 },
};
