import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFAULT_STATE } from "@/lib/equity/types";
import { toast } from "sonner";

export const Route = createFileRoute("/scenarios/")({
  head: () => ({ meta: [{ title: "Your scenarios — EquiCompass" }] }),
  component: ScenariosList,
});

interface ScenarioRow {
  id: string;
  name: string;
  slug: string;
  updated_at: string;
}

function ScenariosList() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScenarioRow[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("scenarios")
      .select("id, name, slug, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows(data ?? []);
      });
  }, [user]);

  const create = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("scenarios")
      .insert({ user_id: user.id, name: "Untitled scenario", state: DEFAULT_STATE as any })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create scenario");
      return;
    }
    navigate({ to: "/scenarios/$id", params: { id: data.id } });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this scenario?")) return;
    const { error } = await supabase.from("scenarios").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((r) => r?.filter((x) => x.id !== id) ?? null);
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/scenarios" className="font-bold text-lg text-foreground">
            EquiCompass
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Your scenarios</h1>
          <Button onClick={create} disabled={creating}>
            {creating ? "Creating…" : "New scenario"}
          </Button>
        </div>

        <div className="mt-8 grid gap-3">
          {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {rows?.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No scenarios yet.</p>
              <Button className="mt-4" onClick={create} disabled={creating}>
                Create your first scenario
              </Button>
            </Card>
          )}
          {rows?.map((s) => (
            <Card key={s.id} className="flex items-center justify-between p-4">
              <Link
                to="/scenarios/$id"
                params={{ id: s.id }}
                className="flex-1 hover:opacity-80"
              >
                <div className="font-medium text-foreground">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  Updated {new Date(s.updated_at).toLocaleString()}
                </div>
              </Link>
              <div className="flex gap-2">
                <Link to="/share/$slug" params={{ slug: s.slug }}>
                  <Button variant="ghost" size="sm">
                    Share link
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
