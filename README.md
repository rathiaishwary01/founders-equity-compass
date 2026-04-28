# CapStack — Founder Equity Simulator

> Model your funding journey before you sign anything.

CapStack is an open-source equity dilution simulator built for founders. It lets you model funding rounds, liquidation preferences, vesting schedules, anti-dilution clauses, and exit waterfalls — and surfaces plain-English negotiation guidance at every step.

<!-- screenshot -->

---

## Why CapStack

Most founders see their cap table for the first time in a VC's term sheet. By then, the leverage is gone. CapStack lets you run the numbers before the meeting: model what a 20% Seed + 25% Series A actually does to your ownership, what a 2× participating preferred costs you at a $50M exit, and which clauses your lawyer should fight for.

---

## Features

| Tab | What it does |
|---|---|
| **Setup** | Define your founding team, market (India/US), board seats, and retention thresholds. Includes a Day 0 legal checklist. |
| **Rounds** | Model up to 5 funding rounds (Pre-seed → Series C) with SAFE conversion, ESOP top-ups, secondary sales, pro-rata, and per-round anti-dilution (none / BBWA / full-ratchet), redemption rights, and pay-to-play clauses. |
| **Cap Table** | Live ownership breakdown at every round with dilution benchmarks, down-round detection, full-ratchet impact comparison, board seat runway, and individual founder nomination eligibility. |
| **Compare** | Save and compare multiple scenarios side-by-side with payout bar charts, delta analysis, and board control comparison. |
| **Exit** | Model any exit value with a full liquidation waterfall, payout curve, VC return multiples, pay-to-play conversion scenario, and redemption risk timeline. |
| **Veto** | 24 VC veto rights grouped into Board & Control / Economics / Founder Protections / Governance — each with exact clause language to negotiate. |
| **Protect** | Key ownership thresholds (75% / 51% / 26%) with market-specific interpretation for India (Companies Act) and US (DGCL). |
| **Playbook** | Personalised action plan sorted by timing (Do Now / Before Next Round / Ongoing) and priority, with specific next steps and negotiation leverage for every finding. |

**Market support:** India (Companies Act, FEMA, angel tax, SEBI norms) and United States (Delaware DGCL, NVCA model documents, 409A, QSBS).

---

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)
- **UI:** React 19, TypeScript, [Tailwind CSS v4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com)
- **Charts:** [Recharts](https://recharts.org)
- **Auth & DB:** [Supabase](https://supabase.com) (optional — the simulator runs fully client-side without it)
- **Deploy:** [Cloudflare Pages](https://pages.cloudflare.com) via Wrangler

---

## Getting Started

```bash
git clone https://github.com/rathiaishwary01/founders-equity-compass.git
cd founders-equity-compass
npm install
cp .env.example .env   # fill in your Supabase credentials (optional)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** The simulator works entirely client-side without Supabase. You only need Supabase credentials if you want scenario save/load and shareable links.

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Optional | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional | Your Supabase anon/public key |

---

## Deployment

```bash
npm run deploy:cloudflare
```

This builds the app and deploys to Cloudflare Pages via Wrangler. Ensure your `wrangler.jsonc` is configured with your account ID and project name.

---

## Project Structure

```
src/
  lib/equity/
    types.ts        # All types: SimulatorState, RoundConfig, Snapshot, etc.
    calc.ts         # Core maths: computeSnaps, calcPayouts, founderPayouts
  components/
    Simulator.tsx   # Main UI component (~3,300 lines)
  routes/
    index.tsx       # Root route
    scenarios.*     # Save/load scenarios (requires Supabase)
    share.*         # Shareable read-only links
  integrations/
    supabase/       # Supabase client and auth
```

---

## Config Files

All config files live at the repo root — most tools require them there.

| File | Purpose |
|---|---|
| `vite.config.ts` | Vite build config. Wires up TanStack Start, React, Tailwind CSS, `vite-tsconfig-paths`, and the Cloudflare adapter (build-only). React and query packages are deduplicated to avoid multiple-instance issues. |
| `tsconfig.json` | TypeScript config — strict mode, `@/*` path alias, bundler module resolution. |
| `eslint.config.js` | ESLint with TypeScript, React Hooks, and Prettier rules. |
| `.prettierrc` | Prettier: 100-char width, double quotes, trailing commas. |
| `wrangler.jsonc` | Cloudflare Workers/Pages deploy config — app name and compatibility flags. |
| `components.json` | shadcn/ui config — component style, Tailwind settings, import aliases. |
| `bunfig.toml` | Bun package manager config (text lockfile disabled). |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE) © 2025 CapStack Contributors
