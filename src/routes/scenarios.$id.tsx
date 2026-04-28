import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Simulator } from "@/components/Simulator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ExportButton } from "@/components/ExportButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_STATE, type SimulatorState } from "@/lib/equity/types";
import { toast } from "sonner";

export const Route = createFileRoute("/scenarios/$id")({
  head: () => ({ meta: [{ title: "Scenario — EquiCompass" }] }),
  component: ScenarioEditor,
});

function ScenarioEditor() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("Untitled scenario");
  const [slug, setSlug] = useState<string>("");
  const [state, setState] = useState<SimulatorState | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("scenarios")
      .select("name, slug, state")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data) {
          toast.error("Scenario not found");
          navigate({ to: "/scenarios" });
          return;
        }
        setName(data.name);
        setSlug(data.slug);
        const loaded = data.state as Partial<SimulatorState>;
        // Deep-merge each round so old saves without antiDilution/preseed still work
        const mergedRounds = { ...DEFAULT_STATE.rounds };
        for (const k of Object.keys(DEFAULT_STATE.rounds) as (keyof typeof DEFAULT_STATE.rounds)[]) {
          mergedRounds[k] = { ...DEFAULT_STATE.rounds[k], ...(loaded.rounds?.[k] ?? {}) };
        }
        setState({
          ...DEFAULT_STATE,
          ...loaded,
          rounds: mergedRounds,
          safe: { ...DEFAULT_STATE.safe, ...(loaded.safe ?? {}) },
        } as SimulatorState);
        isInitialLoad.current = true;
      });
  }, [id, user, navigate]);

  // Debounced auto-save
  useEffect(() => {
    if (!user || !state) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("scenarios")
        .update({ state: state as any, name })
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        setSaveStatus("idle");
      } else {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      }
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, name, id, user]);

  const copyShare = () => {
    const url = `${window.location.origin}/share/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  };

  if (loading || !user || !state) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/scenarios" className="text-sm text-muted-foreground hover:text-foreground">
            ← All scenarios
          </Link>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-sm flex-1"
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : ""}
            </span>
            <ExportButton state={state} scenarioName={name} />
            <Button variant="outline" size="sm" onClick={copyShare}>
              Copy share link
            </Button>
          </div>
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
