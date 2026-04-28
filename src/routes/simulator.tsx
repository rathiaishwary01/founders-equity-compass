import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Simulator } from "@/components/Simulator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ExportButton } from "@/components/ExportButton";
import { DEFAULT_STATE, type SimulatorState } from "@/lib/equity/types";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [{ title: "EquiCompass — Equity Simulator" }],
  }),
  component: SimulatorPage,
});

function SimulatorPage() {
  const [state, setState] = useState<SimulatorState>(DEFAULT_STATE);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              E
            </div>
            <span className="font-bold text-lg text-foreground">EquiCompass</span>
          </Link>
          <ExportButton state={state} scenarioName="My Scenario" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">
        <ErrorBoundary>
          <Simulator state={state} onChange={setState} />
        </ErrorBoundary>
      </main>
    </div>
  );
}
