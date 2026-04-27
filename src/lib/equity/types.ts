export type HolderType = "founder" | "esop" | "advisory" | "vc" | "safe";

export interface Holder {
  name: string;
  role: string;
  pct: number;
  type: HolderType;
}

export type RoundKey = "seed" | "a" | "b" | "c";

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
}

export interface SimulatorState {
  founderSeats: number; // BUG FIX 3 — configurable
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
  "Seed VC": "#e17055",
  "Series A VC": "#d63031",
  "Series B VC": "#c0392b",
  "Series C VC": "#922b21",
};

export const DEFAULT_STATE: SimulatorState = {
  founderSeats: 2,
  safe: { enabled: false, amount: 0.25, cap: 3, discount: 20 },
  rounds: {
    seed: { enabled: false, preMoney: 2.5, raise: 0.5, esop: 10, board: "observer", prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
    a: { enabled: false, preMoney: 10, raise: 3, esop: 12, board: "1", prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
    b: { enabled: false, preMoney: 40, raise: 10, esop: 12, board: "1", prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
    c: { enabled: false, preMoney: 100, raise: 25, esop: 12, board: "1", prefMult: 1, prefType: "non", secondary: 0, prorata: 0 },
  },
  exitValue: 100,
  usePref: true,
};

export const ROUND_LABELS: Record<RoundKey, string> = {
  seed: "Seed",
  a: "Series A",
  b: "Series B",
  c: "Series C",
};

export const ROUND_ICONS: Record<RoundKey, string> = {
  seed: "🌱",
  a: "🚀",
  b: "📈",
  c: "🏆",
};

export const ROUND_BENCHMARKS: Record<RoundKey, { lo: number; hi: number }> = {
  seed: { lo: 12, hi: 20 },
  a: { lo: 15, hi: 25 },
  b: { lo: 15, hi: 22 },
  c: { lo: 12, hi: 20 },
};
