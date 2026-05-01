import { Link } from "@tanstack/react-router";
import { EquiCompassLogo } from "@/components/EquiCompassLogo";

interface Section {
  heading: string;
  body: string;
}

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: Section[] }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b" style={{ borderColor: "oklch(0.22 0.04 265 / 0.08)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3.5">
<Link to="/"><EquiCompassLogo variant="nav" /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "oklch(0.22 0.04 265)" }}>{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        </div>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-base font-semibold mb-2" style={{ color: "oklch(0.22 0.04 265)" }}>{s.heading}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t mt-20" style={{ borderColor: "oklch(0.22 0.04 265 / 0.08)" }}>
        <div className="mx-auto max-w-3xl px-6 py-8 flex flex-wrap gap-4 text-sm" style={{ color: "oklch(0.52 0.03 265)" }}>
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link to="/simulator" className="hover:text-foreground transition-colors">Simulator</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
        </div>
      </footer>
    </div>
  );
}
