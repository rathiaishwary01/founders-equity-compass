import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Simulator } from "@/components/Simulator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DEFAULT_STATE, type SimulatorState } from "@/lib/equity/types";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/share/$slug")({
  head: () => ({
    meta: [
      { title: "Shared scenario — CapStack" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedView,
});

function SharedView() {
  const { slug } = Route.useParams();
  const [name, setName] = useState<string>("");
  const [state, setState] = useState<SimulatorState | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("scenarios")
      .select("name, state")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
          return;
        }
        setName(data.name);
        const loaded = data.state as Partial<SimulatorState>;
        setState({
          ...DEFAULT_STATE,
          ...loaded,
          rounds: { ...DEFAULT_STATE.rounds, ...(loaded.rounds ?? {}) },
          safe: { ...DEFAULT_STATE.safe, ...(loaded.safe ?? {}) },
        } as SimulatorState);
      });
  }, [slug]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Scenario not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This share link may have been removed.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (!state) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="font-bold text-lg text-foreground">
            CapStack
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-medium text-foreground">{name}</h1>
            <Badge variant="secondary">Read-only</Badge>
          </div>
          <Link to="/auth" className="text-sm text-primary hover:underline">
            Make your own →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">
        <ErrorBoundary>
          <Simulator state={state} onChange={() => {}} readOnly />
        </ErrorBoundary>
      </main>
    </div>
  );
}
