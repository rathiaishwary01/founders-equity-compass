import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PieChart,
  Users,
  TrendingUp,
  Globe,
  XCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EquiCompass — Know what you give away before you sign" },
      {
        name: "description",
        content:
          "Equity dilution simulator for Indian and US founders. Model VC rounds, SAFEs, board seats and liquidation preferences in minutes.",
      },
      { property: "og:title", content: "EquiCompass — Equity Dilution Simulator" },
      {
        property: "og:description",
        content:
          "Model every VC round, SAFE, board seat, and liquidation preference before you sign the term sheet.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
              E
            </div>
            <span className="font-bold text-lg text-foreground">EquiCompass</span>
          </div>
          <Link to="/simulator">
            <Button>Open simulator</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <div className="mb-6 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span>🇮🇳</span> India
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span>🇺🇸</span> US
            </span>
            <span className="text-xs text-muted-foreground">Built for both markets</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
            Know exactly what you're giving away before you sign.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
            Model every VC round, SAFE, board seat, and liquidation preference — in minutes. Free and open source.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/simulator">
              <Button size="lg" className="gap-2">
                Try it free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-wrap items-center justify-center gap-3 md:gap-6">
          {[
            "5 rounds modelled",
            "BBWA anti-dilution math",
            "Exit payouts with prefs",
          ].map((s) => (
            <div
              key={s}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground shadow-sm"
            >
              {s}
            </div>
          ))}
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="border-destructive/20">
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6">
                What founders get wrong
              </h3>
              <ul className="space-y-4">
                {[
                  "Board control silently lost at Series A",
                  "Liquidation preferences wipe out founder exit",
                  "ESOP top-ups dilute only founders, not VCs",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6">
                What EquiCompass shows you
              </h3>
              <ul className="space-y-4">
                {[
                  "Exact board seat math round-by-round",
                  "Exit waterfall with 1x / 2x prefs modelled",
                  "Pre-money vs post-money ESOP impact, side by side",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                    <span className="text-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Everything you need before a term sheet lands
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: PieChart,
              title: "Cap Table Simulator",
              desc: "Model Seed → Series C with SAFEs, priced rounds and ESOP top-ups. See dilution at every step.",
            },
            {
              icon: Users,
              title: "Board Control Tracker",
              desc: "Watch founder, investor and independent seats shift across rounds. Know when you lose the room.",
            },
            {
              icon: TrendingUp,
              title: "Exit Payout Calculator",
              desc: "Project individual founder payouts at any exit valuation, with 1x and 2x liquidation preferences.",
            },
            {
              icon: Globe,
              title: "India / US Benchmarks",
              desc: "Term sheet norms from both markets — ESOP sizing, preference stacks and board composition.",
            },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div
          className="rounded-2xl px-8 py-16 md:px-16 text-center"
          style={{ background: "var(--header-gradient)" }}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[color:var(--header-fg)]">
            Your next term sheet is coming.
            <br />
            Be ready.
          </h2>
          <div className="mt-8">
            <Link to="/simulator">
              <Button size="lg" variant="secondary" className="gap-2">
                Open EquiCompass <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
                E
              </div>
              <span className="font-semibold text-foreground">EquiCompass</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-md">
              For negotiation planning only — not legal advice. Open source under MIT licence.
            </p>
          </div>
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/simulator" className="hover:text-foreground">Simulator</Link>
            <a href="https://github.com/EquiCompass/founders-equity-compass" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
