# Contributing to CapStack

Thanks for your interest in contributing. CapStack is a focused tool — the goal is to keep it accurate, fast, and genuinely useful for founders. Here's how to contribute well.

---

## Running Locally

```bash
git clone https://github.com/rathiaishwary01/founders-equity-compass.git
cd founders-equity-compass
npm install
cp .env.example .env   # Supabase credentials are optional
npm run dev
```

The simulator runs fully in the browser — Supabase is only needed for scenario persistence and shareable links.

---

## Where Things Live

| File | Purpose |
|---|---|
| `src/lib/equity/types.ts` | All TypeScript types: `SimulatorState`, `RoundConfig`, `Snapshot`, `Holder`, etc. Start here to understand the data model. |
| `src/lib/equity/calc.ts` | All calculation logic: `computeSnaps` (dilution engine), `calcPayouts` (exit waterfall), `founderPayouts` (vesting-aware payouts). Pure functions — no React. |
| `src/components/Simulator.tsx` | The entire UI. Tabs, charts, recommendations, veto items, export modal. |
| `src/routes/` | TanStack Router routes — index (simulator), scenarios (save/load), share (read-only links). |

---

## Branch Naming

```
feat/your-feature-name     # new features
fix/what-you-are-fixing    # bug fixes
chore/what-you-are-doing   # tooling, deps, docs
```

---

## PR Checklist

Before opening a pull request:

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No new `console.log()` calls in `src/` (use comments or remove debug output)
- [ ] If you changed calculation logic in `calc.ts`, add a comment explaining the formula with a worked example
- [ ] If you changed the UI, include a screenshot or screen recording in the PR description
- [ ] If you added a new veto item or recommendation, verify the market flag (`"both"` / `"india"` / `"us"`) is correct and the clause language is legally grounded

---

## Calculation Conventions

- All monetary values are in **$M** (millions of USD) throughout the codebase
- Percentages are stored as **0–100** (not 0–1)
- `computeSnaps` is the source of truth for ownership — never compute dilution outside it
- `calcPayouts` handles the liquidation waterfall — preference logic lives entirely there

---

## What We're Not Looking For

- UI library swaps or design system changes
- New dependencies without discussion (open an issue first)
- Changes to default round sizes or benchmarks without cited sources (Inc42, NVCA Yearbook, Carta, etc.)

---

## Reporting Issues

Open a GitHub issue with:
- What you modelled (round sizes, pref terms)
- What the tool showed
- What you expected instead
- Screenshots help

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
