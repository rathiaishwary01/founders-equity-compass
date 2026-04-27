import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Equity Dilution Simulator — For Indian Startup Founders" },
      {
        name: "description",
        content:
          "Model funding rounds, ESOP top-ups, board control and exit payouts. Save and share scenarios.",
      },
      { property: "og:title", content: "Equity Dilution Simulator" },
      {
        property: "og:description",
        content: "Model your cap table, board control and exit payouts.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/scenarios" });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="font-bold text-lg text-foreground">CapStack</div>
          <div className="flex gap-2">
            <Link to="/auth">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Equity dilution, demystified.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Model Seed → Series C rounds, plan ESOP top-ups, see board control shifts and project
            exit payouts for every founder. Built for Indian startup founders.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth">
              <Button size="lg">Start a free scenario</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
